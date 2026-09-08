import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { formatIls, listingBadgeTone, localizedTitle } from '@/src/lib/format';
import { apartmentWriteFields, copyListingTitles } from '@/src/lib/listing';
import { verifiedTotpFactor } from '@/src/lib/mfa';
import { alert } from '@/src/lib/notice';
import { OWNER_LISTING_PAGE_SIZE } from '@/src/lib/page';
import { listingGateMessage, ownerReadyForListing } from '@/src/lib/trust';
import { ownerListingGapTab } from '@/src/lib/studentProfile';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, ListingStatus } from '@/src/types/database';

type Filter = 'all' | ListingStatus;

export default function OwnerListings() {
  const { t, i18n } = useTranslation();
  const { rtlText, writingDirection, textAlign, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Apartment[]>([]);
  const [stats, setStats] = useState<Record<string, { views: number; saves: number }>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
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
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*)')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });
    setListings((data as Apartment[]) ?? []);
    try {
      const { data: rows } = await supabase.rpc('owner_listing_stats');
      const next: Record<string, { views: number; saves: number }> = {};
      for (const row of (rows as { apartment_id: string; views: number; saves: number }[]) ?? []) {
        next[row.apartment_id] = { views: Number(row.views) || 0, saves: Number(row.saves) || 0 };
      }
      setStats(next);
    } catch {
      setStats({});
    }
  }, [profile]);

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

  const visible = useMemo(
    () => (filter === 'all' ? listings : listings.filter((item) => item.status === filter)),
    [filter, listings],
  );
  const paged = usePaged(visible, OWNER_LISTING_PAGE_SIZE, filter);

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
    if (profile?.owner_status === 'rejected') {
      alert(t('common.error'), t('owner.listingSuspended'));
      return;
    }
    if (!canList) {
      alert(t('common.error'), t('owner.listingNeedVerify'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.title'),
          onPress: goProfileGap,
        },
      ]);
      return;
    }
    router.push('/(owner)/listing/new');
  };

  const removeListing = (id: string) => {
    alert(t('owner.deleteListing'), t('owner.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
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
      alert(t('common.error'), t('owner.listingNeedVerify'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.title'), onPress: goProfileGap },
      ]);
      return;
    }
    const { error } = await supabase.from('apartments').update({ status: 'approved' }).eq('id', id);
    if (error) {
      alert(t('common.error'), listingGateMessage(error.message, t) || error.message);
      return;
    }
    void load();
  };

  const duplicateListing = async (item: Apartment) => {
    if (!canList) {
      alert(t('common.error'), t('owner.listingNeedVerify'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.title'), onPress: goProfileGap },
      ]);
      return;
    }
    const { data, error } = await supabase
      .from('apartments')
      .insert({
        ...apartmentWriteFields(item),
        ...copyListingTitles(item, t('owner.copySuffix')),
      })
      .select('id')
      .single();
    if (error) {
      alert(t('common.error'), listingGateMessage(error.message, t) || error.message);
      return;
    }
    alert(t('common.done'), t('owner.duplicated'));
    if (data?.id) router.push({ pathname: '/(owner)/listing/[id]', params: { id: data.id } });
    else void load();
  };

  const filters: Filter[] = ['all', 'pending', 'approved', 'hidden', 'rejected'];

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.listings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('owner.yourListings')}</Text>
          <Text style={[styles.count, rtlText, { color: colors.textMuted }]}>
            {t('owner.listingCount', { count: listings.length })}
          </Text>
        </View>
      </View>

      {profile?.owner_status === 'pending' ? (
        <View style={[styles.warnBox, { backgroundColor: colors.warningSoft }]}>
          <Ionicons name="time-outline" size={18} color={colors.warning} />
          <Text style={[styles.warn, { writingDirection, textAlign, color: colors.warning }]}>
            {t('owner.listingNeedApproval')}
          </Text>
        </View>
      ) : null}
      {profile?.owner_status === 'rejected' ? (
        <View style={[styles.warnBox, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={[styles.warn, { writingDirection, textAlign, color: colors.danger }]}>
            {t('owner.listingSuspended')}
          </Text>
        </View>
      ) : null}
      {profile?.owner_status === 'approved' && !canList ? (
        <Pressable
          onPress={goProfileGap}
          style={[styles.warnBox, { backgroundColor: colors.warningSoft }]}
        >
          <Ionicons name="shield-outline" size={18} color={colors.warning} />
          <Text style={[styles.warn, { writingDirection, textAlign, color: colors.warning }]}>
            {t('owner.listingNeedVerify')}
          </Text>
        </Pressable>
      ) : null}
      {!mfaOn ? (
        <Pressable
          onPress={() => router.push({ pathname: '/(owner)/(tabs)/profile', params: { tab: 'security' } })}
          style={[styles.warnBox, { backgroundColor: colors.primarySoft }]}
        >
          <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
          <Text style={[styles.warn, { writingDirection, textAlign, color: colors.primary }]}>
            {t('owner.mfaNudge')}
          </Text>
        </Pressable>
      ) : null}

      <Button title={t('owner.addListing')} onPress={gateAdd} pill />

      <FilterPills
        value={filter}
        onChange={setFilter}
        items={filters.map((value) => ({
          value,
          label: value === 'all' ? t('common.all') : t(`status.${value}`),
          count: counts[value],
        }))}
      />

      {visible.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, rtlText, { color: colors.textMuted }]}>
            {listings.length === 0 ? t('owner.empty') : t('owner.emptyFiltered')}
          </Text>
          {listings.length === 0 ? <Button title={t('owner.addFirst')} onPress={gateAdd} pill /> : null}
        </View>
      ) : null}

      {paged.slice.map((item) => {
        const open = openId === item.id;
        const title = localizedTitle(item, i18n.language);
        const photo = item.photos?.[0];
        const tone = listingBadgeTone(item.status);
        return (
          <View
            key={item.id}
            style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Pressable
              onPress={() => setOpenId(open ? null : item.id)}
              style={[styles.rowMain, row]}
              accessibilityRole="button"
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="home-outline" size={18} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, rtlText, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={[styles.rowMeta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
                  {formatIls(item.price_month, i18n.language)} · {item.photos?.length ?? 0}{' '}
                  {t('owner.photosShort')}
                  {stats[item.id]
                    ? ` · ${t('owner.insightsViews', { count: stats[item.id].views })} · ${t('owner.insightsSaves', { count: stats[item.id].saves })}`
                    : ''}
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
                  <Pressable
                    onPress={() => void duplicateListing(item)}
                    style={[styles.action, { backgroundColor: colors.accentSoft }]}
                  >
                    <Text style={[styles.actionText, { color: colors.primaryDark }]}>{t('owner.duplicate')}</Text>
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
                  <Pressable
                    onPress={() => removeListing(item.id)}
                    style={[styles.action, { backgroundColor: colors.dangerSoft }]}
                  >
                    <Text style={[styles.actionDangerText, { color: colors.danger }]}>{t('owner.deleteListing')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      <Pager
        page={paged.page}
        pages={paged.pages}
        from={paged.from}
        to={paged.to}
        total={paged.total}
        pageSize={paged.pageSize}
        onPage={paged.setPage}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  count: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warn: { flex: 1, lineHeight: 20, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: 24,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
  rowCard: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  rowMain: { alignItems: 'center', gap: 10, padding: 10 },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 14, fontFamily: 'Cairo_800ExtraBold' },
  rowMeta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  rowActions: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  actions: { flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  action: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  actionDangerText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
});
