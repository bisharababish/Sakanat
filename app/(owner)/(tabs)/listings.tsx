import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Pager } from '@/components/ui/Pager';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TabPageHeader } from '@/components/ui/TabPageHeader';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { formatIls, listingBadgeTone, localizedTitle } from '@/src/lib/format';
import { buildingKey, buildingTitle, compareListingPlace, listingPlaceLine, uniqueBuildings } from '@/src/lib/listingPlace';
import { listingNeedsStayNotes } from '@/src/lib/listingStay';
import { verifiedTotpFactor } from '@/src/lib/mfa';
import { alert } from '@/src/lib/notice';
import { OWNER_LISTING_PAGE_SIZE } from '@/src/lib/page';
import { listingGateMessage, ownerReadyForListing } from '@/src/lib/trust';
import { ownerListingGapTab } from '@/src/lib/studentProfile';
import { mailTo, supportWhatsAppUrl } from '@/src/lib/support';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, ListingStatus } from '@/src/types/database';

type Filter = 'all' | ListingStatus;

export default function OwnerListings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState<
    Record<string, { views: number; saves: number; chats: number; bookings: number }>
  >({});
  const [filter, setFilter] = useState<Filter>('all');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const [mfaOn, setMfaOn] = useState(true);

  const canList = ownerReadyForListing(profile);

  useEffect(() => {
    let alive = true;
    void verifiedTotpFactor()
      .then((factor) => {
        if (alive) setMfaOn(Boolean(factor));
      })
      .catch(() => {
        if (alive) setMfaOn(false);
      });
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('apartments')
        .select('*, cities(*), universities(*)')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setListings((data as Apartment[]) ?? []);
      try {
        const { data: rows } = await supabase.rpc('owner_listing_stats');
        const next: Record<string, { views: number; saves: number; chats: number; bookings: number }> = {};
        for (const row of ((rows as {
          apartment_id: string;
          views: number;
          saves: number;
          chats?: number;
          bookings?: number;
        }[]) ?? [])) {
          next[row.apartment_id] = {
            views: Number(row.views) || 0,
            saves: Number(row.saves) || 0,
            chats: Number(row.chats) || 0,
            bookings: Number(row.bookings) || 0,
          };
        }
        setStats(next);
      } catch {
        setStats({});
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  const { refreshing, refresh } = useLiveReload(load, ['apartments'], `owner-listings:${profile?.id ?? ''}`);

  const counts = useMemo(() => {
    const next: Record<Filter, number> = {
      all: listings.length,
      pending: 0,
      approved: 0,
      hidden: 0,
      rejected: 0,
    };
    for (const item of listings) next[item.status] += 1;
    return next;
  }, [listings]);

  const buildings = useMemo(
    () => uniqueBuildings(listings, i18n.language, t('owner.untitledUnit')),
    [i18n.language, listings, t],
  );

  const visible = useMemo(() => {
    const list = filter === 'all' ? listings : listings.filter((item) => item.status === filter);
    const placed = buildingFilter === 'all' ? list : list.filter((item) => buildingKey(item) === buildingFilter);
    return [...placed].sort((a, b) => compareListingPlace(a, b, i18n.language));
  }, [buildingFilter, filter, i18n.language, listings]);
  const paged = usePaged(visible, OWNER_LISTING_PAGE_SIZE, `${filter}:${buildingFilter}`);

  const goProfileGap = () => {
    router.push({
      pathname: '/(owner)/(tabs)/profile',
      params: { tab: ownerListingGapTab(profile) },
    });
  };

  const gateAdd = () => {
    if (profile?.owner_status === 'pending') {
      alert(t('common.error'), t('owner.listingNeedApproval'));
      return;
    }
    if (profile?.owner_status === 'rejected' || !canList) {
      goProfileGap();
      return;
    }
    router.push('/(owner)/listing/new');
  };

  const hideListing = (id: string) => {
    alert(t('owner.hideListing'), t('owner.confirmHide'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.hideListing'),
        onPress: async () => {
          const { error } = await supabase.from('apartments').update({ status: 'hidden' }).eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const unhideListing = async (id: string) => {
    if (!canList) {
      goProfileGap();
      return;
    }
    const { error } = await supabase.from('apartments').update({ status: 'approved' }).eq('id', id);
    if (error) {
      alert(t('common.error'), listingGateMessage(error.message, t) || error.message);
      return;
    }
    void load();
  };

  const filters: Filter[] = ['all', 'pending', 'approved', 'hidden', 'rejected'];
  const listingAlert =
    profile?.owner_status === 'rejected'
      ? {
          icon: 'alert-circle-outline' as const,
          color: colors.danger,
          bg: colors.dangerSoft,
          text: t('owner.listingSuspended'),
          onPress: goProfileGap,
        }
      : profile?.owner_status === 'pending'
        ? {
            icon: 'time-outline' as const,
            color: colors.warning,
            bg: colors.warningSoft,
            text: t('owner.listingNeedApproval'),
            onPress: () => {
              const url =
                supportWhatsAppUrl(t('menu.whatsappPrefill')) ?? mailTo(t('menu.supportSubject'));
              void Linking.openURL(url);
            },
          }
        : profile?.owner_status === 'approved' && !canList
          ? {
              icon: 'shield-outline' as const,
              color: colors.warning,
              bg: colors.warningSoft,
              text: t('owner.listingNeedVerify'),
              onPress: goProfileGap,
            }
          : !mfaOn
            ? {
                icon: 'lock-closed-outline' as const,
                color: colors.primary,
                bg: colors.primarySoft,
                text: t('owner.mfaNudge'),
                onPress: () =>
                  router.push({ pathname: '/(owner)/(tabs)/profile', params: { tab: 'security' } }),
              }
            : null;

  return (
    <>
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      back={filter !== 'all' || buildingFilter !== 'all'}
      onBack={() => {
        if (filter !== 'all') setFilter('all');
        else setBuildingFilter('all');
      }}
    >
      <OfflineBanner />
      <TabPageHeader
        kicker={t('tabs.listings')}
        title={t('owner.yourListings')}
        hint={t('owner.listingCount', { count: listings.length })}
        trailing={<Button title={t('owner.addListing')} onPress={gateAdd} pill compact />}
      />

      {listingAlert ? (
        <Pressable
          onPress={listingAlert.onPress}
          disabled={!listingAlert.onPress}
          style={[styles.warnBox, { backgroundColor: listingAlert.bg }]}
        >
          <Ionicons name={listingAlert.icon} size={18} color={listingAlert.color} />
          <Text style={[styles.warn, rtlText, { color: listingAlert.color }]}>
            {listingAlert.text}
          </Text>
        </Pressable>
      ) : null}

      <FilterPills
        compact
        value={filter}
        onChange={setFilter}
        items={filters.map((value) => ({
          value,
          label: value === 'all' ? t('common.all') : t(`status.${value}`),
          count: counts[value],
        }))}
      />
      {buildings.length > 1 ? (
        <FilterPills
          compact
          value={buildingFilter}
          onChange={setBuildingFilter}
          items={[
            { value: 'all', label: t('owner.allBuildings'), count: listings.length },
            ...buildings.map((item) => ({ value: item.key, label: item.name, count: item.count })),
          ]}
        />
      ) : null}

      {loading ? <ListSkeleton rows={3} cover /> : null}
      {!loading && loadError ? (
        <EmptyState
          title={t('common.error')}
          hint={loadError}
          actionTitle={t('common.retry')}
          onAction={() => {
            setLoading(true);
            void refresh();
          }}
        />
      ) : null}
      {!loading && !loadError && visible.length === 0 ? (
        <EmptyState
          title={listings.length === 0 ? t('owner.empty') : t('owner.emptyFiltered')}
          actionTitle={listings.length === 0 ? t('owner.addFirst') : undefined}
          onAction={listings.length === 0 ? gateAdd : undefined}
        />
      ) : null}

      {!loading && !loadError
        ? paged.slice.map((item, index) => {
        const open = openId === item.id;
        const title = localizedTitle(item, i18n.language);
        const photo = item.photos?.[0];
        const tone = listingBadgeTone(item.status);
        const prev = paged.slice[index - 1];
        const showBuilding = !prev || buildingKey(prev) !== buildingKey(item);
        const place = listingPlaceLine(item, t, { skipBuilding: true });
        return (
          <View key={item.id}>
            {showBuilding ? (
              <Text style={[styles.group, rtlText, { color: colors.primary }]}>
                {buildingTitle(item, i18n.language, t('owner.untitledUnit'))}
              </Text>
            ) : null}
          <View
            style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Pressable
              onPress={() => setOpenId(open ? null : item.id)}
              style={[styles.rowMain, row]}
              accessibilityRole="button"
            >
              {photo ? (
                <Pressable
                  onPress={() =>
                    item.photos?.length
                      ? setViewer({ photos: item.photos, index: 0 })
                      : setOpenId(open ? null : item.id)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('listing.viewPhoto')}
                >
                  <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
                </Pressable>
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="home-outline" size={18} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.rowCopy}>
                <View style={[styles.titleLine, row]}>
                  <Text style={[styles.rowTitle, rtlText, { color: colors.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                  {listingNeedsStayNotes(item) ? (
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color={colors.warning}
                      accessibilityLabel={t('owner.needsStayNotes')}
                    />
                  ) : null}
                </View>
                <Text style={[styles.rowMeta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
                  {[
                    place,
                    formatIls(item.price_month, i18n.language),
                    stats[item.id]
                      ? `${t('owner.insightsViews', { count: stats[item.id].views })} · ${t('owner.insightsBookings', { count: stats[item.id].bookings })}`
                      : `${item.photos?.length ?? 0} ${t('owner.photosShort')}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <StatusBadge label={t(`status.${item.status}`)} tone={tone} />
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>

            {open ? (
              <View style={styles.rowActions}>
                {stats[item.id] ? (
                  <View style={[styles.actions, row]}>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/(owner)/(tabs)/chat', params: { apartmentId: item.id } })
                      }
                      style={[styles.action, { backgroundColor: colors.primarySoft }]}
                    >
                      <Text style={[styles.actionText, { color: colors.primary }]}>
                        {t('owner.insightsChats', { count: stats[item.id].chats })}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/(owner)/(tabs)/bookings', params: { listing: item.id } })
                      }
                      style={[styles.action, { backgroundColor: colors.accentSoft }]}
                    >
                      <Text style={[styles.actionText, { color: colors.primaryDark }]}>
                        {t('owner.insightsBookings', { count: stats[item.id].bookings })}
                      </Text>
                    </Pressable>
                    {(item.review_count ?? 0) > 0 ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/(owner)/apartment/[id]',
                            params: { id: item.id, focus: 'reviews' },
                          })
                        }
                        style={[styles.action, { backgroundColor: colors.accentSoft }]}
                      >
                        <Text style={[styles.actionText, { color: colors.primaryDark }]}>
                          {t('review.count', { count: item.review_count })}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {listingNeedsStayNotes(item) ? (
                  <Text style={[styles.warn, rtlText, { color: colors.warning }]}>{t('owner.needsStayNotes')}</Text>
                ) : null}
                {item.status === 'rejected' && item.reject_reason ? (
                  <Text style={[styles.warn, rtlText, { color: colors.warning }]}>
                    {t('admin.rejectedNote', { note: item.reject_reason })}
                  </Text>
                ) : null}
                <View style={[styles.actions, row]}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/(owner)/listing/[id]', params: { id: item.id } })}
                    style={[styles.action, { backgroundColor: colors.primarySoft }]}
                  >
                    <Text style={[styles.actionText, { color: colors.primary }]}>{t('common.edit')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push({ pathname: '/(owner)/apartment/[id]', params: { id: item.id } })}
                    style={[styles.action, { backgroundColor: colors.accentSoft }]}
                  >
                    <Text style={[styles.actionText, { color: colors.primaryDark }]}>{t('owner.preview')}</Text>
                  </Pressable>
                  {item.status === 'approved' ? (
                    <Pressable
                      onPress={() => hideListing(item.id)}
                      style={[styles.action, { backgroundColor: colors.accentSoft }]}
                    >
                      <Text style={[styles.actionText, { color: colors.primaryDark }]}>{t('owner.hideListing')}</Text>
                    </Pressable>
                  ) : null}
                  {item.status === 'hidden' ? (
                    <Pressable
                      onPress={() => void unhideListing(item.id)}
                      style={[styles.action, { backgroundColor: colors.accentSoft }]}
                    >
                      <Text style={[styles.actionText, { color: colors.primaryDark }]}>{t('owner.unhideListing')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
          </View>
        );
      })
        : null}
      {!loading && !loadError ? (
      <Pager
        page={paged.page}
        pages={paged.pages}
        from={paged.from}
        to={paged.to}
        total={paged.total}
        pageSize={paged.pageSize}
        onPage={paged.setPage}
      />
      ) : null}
    </Screen>
    <PhotoViewer
      photos={viewer?.photos ?? []}
      index={viewer?.index ?? 0}
      visible={Boolean(viewer?.photos.length)}
      onIndexChange={(index) => setViewer((current) => (current ? { ...current, index } : current))}
      onClose={() => setViewer(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  count: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  group: { fontSize: 12, fontFamily: 'Cairo_700Bold', marginTop: 6, marginBottom: 2 },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warn: { flex: 1, lineHeight: 20, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  rowCard: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  rowMain: { alignItems: 'center', gap: 10, padding: 10 },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { alignItems: 'center', gap: 6 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: 'Cairo_800ExtraBold' },
  rowMeta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  rowActions: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  actions: { flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  action: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  actionDangerText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
});
