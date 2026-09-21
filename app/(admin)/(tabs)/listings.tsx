import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { NoteModal } from '@/components/ui/NoteModal';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { listingBadgeTone, localizedTitle } from '@/src/lib/format';
import { LISTING_REJECT_PRESETS } from '@/src/lib/listingQuality';
import { updateListingStatus } from '@/src/lib/listing';
import { notifyListingApproved, notifyListingRejected } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { ADMIN_LISTING_PAGE_SIZE } from '@/src/lib/page';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, ListingStatus } from '@/src/types/database';

type Filter = 'all' | ListingStatus;

export default function AdminListings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromSettings = params.from === 'settings';
  const backToSettings = () =>
    router.push('/(admin)/(tabs)');
  const [listings, setListings] = useState<Apartment[]>([]);
  const [status, setStatus] = useState<Filter>('pending');
  const [query, setQuery] = useState('');
  const [rejecting, setRejecting] = useState<Apartment | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email)')
      .order('created_at', { ascending: false });
    setListings((data as Apartment[]) ?? []);
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['apartments'], 'admin-listings');

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

  const setListingStatus = async (item: Apartment, next: ListingStatus, reason?: string | null) => {
    setBusy(true);
    const { error } = await updateListingStatus(item.id, next, reason);
    setBusy(false);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    if (next === 'approved' && item.owner_id && item.status !== 'approved') notifyListingApproved(item.owner_id);
    if (next === 'rejected' && item.owner_id && item.status !== 'rejected') notifyListingRejected(item.owner_id);
    setRejecting(null);
    setRejectNote('');
    void load();
  };

  const removeListing = (item: Apartment) => {
    alert(t('admin.deleteListing'), t('admin.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', item.id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const visible = useMemo(() => {
    const byStatus = status === 'all' ? listings : listings.filter((item) => item.status === status);
    const needle = query.trim().toLowerCase();
    if (!needle) return byStatus;
    return byStatus.filter((item) => {
      const hay = [
        localizedTitle(item, i18n.language),
        item.title_ar,
        item.title_en,
        item.profiles?.full_name,
        item.profiles?.email,
        item.profiles?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [listings, status, query, i18n.language]);
  const paged = usePaged(visible, ADMIN_LISTING_PAGE_SIZE, `${status}|${query}`);

  const openListing = (id: string) => {
    router.push({ pathname: '/(admin)/apartment/[id]', params: { id } });
  };

  const filters: Filter[] = ['all', 'pending', 'approved', 'hidden', 'rejected'];

  return (
    <Screen
      back={fromSettings}
      onBack={fromSettings ? backToSettings : undefined}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
    >
      <View style={styles.head}>
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.listings')}</Text>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.listings')}</Text>
      </View>
      <Button title={t('owner.addListing')} pill onPress={() => router.push('/(admin)/listing/new')} />
      <Input compact label={t('admin.searchListings')} value={query} onChangeText={setQuery} />
      <FilterPills
        compact
        value={status}
        onChange={setStatus}
        items={filters.map((value) => ({
          value,
          label: value === 'all' ? t('common.all') : t(`status.${value}`),
          count: counts[value],
        }))}
      />
      {visible.length === 0 ? <EmptyState title={t('admin.noListings')} /> : null}
      {paged.slice.map((item) => (
        <View key={item.id} style={styles.block}>
          {item.profiles?.full_name ? (
            <Text style={[styles.owner, rtlText, { color: colors.text }]}>
              {t('admin.ownerName')}: {item.profiles.full_name}
            </Text>
          ) : null}
          {item.status === 'rejected' && item.reject_reason ? (
            <Text style={[styles.owner, rtlText, { color: colors.warning }]}>
              {t('admin.rejectedNote', { note: item.reject_reason })}
            </Text>
          ) : null}
          <ListingCard
            apartment={item}
            university={item.universities}
            distanceKm={item.campus_distance_km}
            badge={{ label: t(`status.${item.status}`), tone: listingBadgeTone(item.status) }}
            onPress={() => openListing(item.id)}
          />
          <View style={[styles.actions, row]}>
            {item.status !== 'approved' ? (
              <Button compact pill title={t('admin.approve')} onPress={() => void setListingStatus(item, 'approved')} />
            ) : (
              <Button
                compact
                pill
                title={t('owner.hideListing')}
                variant="secondary"
                onPress={() => void setListingStatus(item, 'hidden')}
              />
            )}
            {item.status === 'hidden' ? (
              <Button
                compact
                pill
                title={t('owner.unhideListing')}
                variant="secondary"
                onPress={() => void setListingStatus(item, 'approved')}
              />
            ) : null}
            {item.status !== 'rejected' ? (
              <Button
                compact
                pill
                title={t('admin.reject')}
                variant="danger"
                onPress={() => {
                  setRejectNote('');
                  setRejecting(item);
                }}
              />
            ) : null}
            <Button
              compact
              pill
              title={t('owner.editListing')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/(admin)/listing/[id]', params: { id: item.id } })}
            />
            <Button compact pill title={t('admin.deleteListing')} variant="ghost" onPress={() => removeListing(item)} />
          </View>
        </View>
      ))}
      <Pager
        page={paged.page}
        pages={paged.pages}
        from={paged.from}
        to={paged.to}
        total={paged.total}
        pageSize={paged.pageSize}
        onPage={paged.setPage}
      />
      <NoteModal
        visible={Boolean(rejecting)}
        title={t('admin.rejectListing')}
        label={t('booking.rejectNote')}
        hint={t('admin.rejectListingHint')}
        value={rejectNote}
        confirmTitle={t('admin.reject')}
        loading={busy}
        presets={LISTING_REJECT_PRESETS.map((key) => t(`admin.${key}`))}
        onChange={setRejectNote}
        onConfirm={() => rejecting && void setListingStatus(rejecting, 'rejected', rejectNote)}
        onClose={() => setRejecting(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  block: { gap: 6 },
  owner: { fontWeight: '700', fontFamily: 'Cairo_700Bold', fontSize: 13 },
  actions: { flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
