import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { NoteModal } from '@/components/ui/NoteModal';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAdminPendingCounts } from '@/src/hooks/useAdminPendingCounts';
import { loadAnalyticsSummary, type AnalyticsSummary } from '@/src/lib/analytics';
import { paymentBucket } from '@/src/lib/booking';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { updateListingStatus } from '@/src/lib/listing';
import { LISTING_REJECT_PRESETS } from '@/src/lib/listingQuality';
import { notifyListingApproved, notifyListingRejected } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { hasIdDocs } from '@/src/lib/trust';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, Booking, Profile } from '@/src/types/database';

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function StatTile({
  icon,
  label,
  value,
  meta,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  meta: string;
  onPress: () => void;
}) {
  const { rtlText } = useLayout();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.tileLabel, rtlText, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.tileValue, rtlText, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.tileMeta, rtlText, { color: colors.textMuted }]}>{meta}</Text>
    </Pressable>
  );
}

export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const { rtlText, row, lang, textAlign, writingDirection } = useLayout();
  const colors = useColors();
  const pendingCounts = useAdminPendingCounts();
  const { universities } = useCatalog();
  const [owners, setOwners] = useState<Profile[]>([]);
  const [pendingIds, setPendingIds] = useState<Profile[]>([]);
  const [students, setStudents] = useState(0);
  const [renters, setRenters] = useState(0);
  const [listings, setListings] = useState<Apartment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [chats, setChats] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<7 | 30>(7);
  const [rejecting, setRejecting] = useState<Apartment | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [profileRes, listingRes, bookingRes, chatRes, analyticsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, owner_status, phone, id_verify_status, national_id_url, university_card_url'),
      supabase.from('apartments').select('id, title_ar, title_en, status, owner_id, reject_reason'),
      supabase.from('bookings').select('id, status, commission_amount, payment_method, created_at'),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      loadAnalyticsSummary(analyticsDays).catch(() => null),
    ]);
    const profiles = (profileRes.data as Profile[]) ?? [];
    setStudents(profiles.filter((item) => item.role === 'student').length);
    setRenters(profiles.filter((item) => item.role === 'renter').length);
    setOwners(profiles.filter((item) => item.role === 'owner'));
    setPendingIds(
      profiles.filter(
        (item) =>
          (item.role === 'student' || item.role === 'renter' || item.role === 'owner') &&
          item.id_verify_status === 'pending' &&
          hasIdDocs(item),
      ),
    );
    setListings((listingRes.data as Apartment[]) ?? []);
    setBookings((bookingRes.data as Booking[]) ?? []);
    setChats(chatRes.count ?? 0);
    setAnalytics(analyticsRes);
  }, [analyticsDays]);

  const { refreshing, refresh } = useLiveReload(
    load,
    ['profiles', 'apartments', 'bookings', 'conversations'],
    'admin-overview',
  );

  const earned = useMemo(() => bookings.filter((item) => item.status === 'confirmed' || item.status === 'completed'), [bookings]);
  const monthly = earned.filter((item) => isThisMonth(item.created_at)).reduce((sum, item) => sum + Number(item.commission_amount), 0);
  const allTime = earned.reduce((sum, item) => sum + Number(item.commission_amount), 0);
  const paySplit = useMemo(() => {
    const next = {
      cash: { fee: 0, count: 0 },
      check: { fee: 0, count: 0 },
      visa: { fee: 0, count: 0 },
    };
    for (const item of earned) {
      const bucket = paymentBucket(item.payment_method);
      next[bucket].fee += Number(item.commission_amount);
      next[bucket].count += 1;
    }
    return next;
  }, [earned]);
  const pendingOwners = owners.filter((item) => item.owner_status === 'pending');
  const pendingListings = listings.filter((item) => item.status === 'pending');
  const pendingBookings = bookings.filter((item) => item.status === 'pending').length;
  const liveListings = listings.filter((item) => item.status === 'approved').length;
  const activeOwners = owners.filter((item) => item.owner_status === 'approved').length;
  const chartDays = useMemo(() => {
    const days = analytics?.byDay ?? [];
    if (days.length <= 12) return days;
    const size = Math.ceil(days.length / 10);
    const buckets: { key: string; label: string; views: number; books: number }[] = [];
    for (let i = 0; i < days.length; i += size) {
      const slice = days.slice(i, i + size);
      buckets.push({
        key: slice[0].key,
        label: slice[0].label,
        views: slice.reduce((sum, day) => sum + day.views, 0),
        books: slice.reduce((sum, day) => sum + day.books, 0),
      });
    }
    return buckets;
  }, [analytics?.byDay]);

  const setOwnerStatus = async (id: string, owner_status: 'approved' | 'rejected' = 'approved') => {
    const { error } = await supabase.from('profiles').update({ owner_status }).eq('id', id);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    if (owner_status === 'rejected') {
      await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', id);
    }
    void load();
  };

  const setListingStatus = async (item: Apartment, status: 'approved' | 'rejected' = 'approved', reason?: string | null) => {
    setBusy(true);
    const { error } = await updateListingStatus(item.id, status, reason);
    setBusy(false);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    if (status === 'approved' && item.owner_id) notifyListingApproved(item.owner_id);
    if (status === 'rejected' && item.owner_id) notifyListingRejected(item.owner_id);
    setRejecting(null);
    setRejectNote('');
    void load();
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('roles.admin')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.overview')}</Text>

      <Pressable
        onPress={() => router.push('/(admin)/(tabs)/bookings')}
        style={[styles.hero, { backgroundColor: colors.primary, shadowColor: colors.text }]}
      >
        <Text style={styles.heroLabel}>{t('admin.monthlyCommission')}</Text>
        <Text style={styles.heroValue}>{formatIls(monthly, lang)}</Text>
        <Text style={styles.heroMeta}>
          {t('admin.allTimeCommission')}: {formatIls(allTime, lang)}
        </Text>
      </Pressable>

      <Card compact>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.analyticsTitle')}</Text>
        <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.analyticsHint')}</Text>
        <FilterPills
          compact
          value={String(analyticsDays) as '7' | '30'}
          onChange={(next) => setAnalyticsDays(next === '30' ? 30 : 7)}
          items={[
            { value: '7', label: t('admin.analyticsDays7') },
            { value: '30', label: t('admin.analyticsDays30') },
          ]}
        />
        <View style={[styles.splitRow, row]}>
          <Text style={[styles.splitLabel, { textAlign, writingDirection, color: colors.text }]}>
            {t('admin.analyticsConversion')}
          </Text>
          <Text style={[styles.splitValue, { color: colors.primary }]}>
            {`${analytics?.conversion ?? 0}%`}
          </Text>
        </View>
        <View style={[styles.splitRow, row]}>
          <Text style={[styles.splitLabel, { textAlign, writingDirection, color: colors.text }]}>
            {t('admin.analyticsViews')}
          </Text>
          <Text style={[styles.splitValue, { color: colors.primary }]}>
            {String(analytics?.totals.listing_view ?? 0)}
          </Text>
        </View>
        <View style={[styles.splitRow, row]}>
          <Text style={[styles.splitLabel, { textAlign, writingDirection, color: colors.text }]}>
            {t('admin.analyticsBookings')}
          </Text>
          <Text style={[styles.splitValue, { color: colors.primary }]}>
            {String(analytics?.totals.booking_request ?? 0)}
          </Text>
        </View>
        <View style={[styles.splitRow, row]}>
          <Text style={[styles.splitLabel, { textAlign, writingDirection, color: colors.text }]}>
            {t('admin.analyticsSearch')}
          </Text>
          <Text style={[styles.splitValue, { color: colors.primary }]}>
            {String(analytics?.totals.search_open ?? 0)}
          </Text>
        </View>
        <View style={[styles.splitRow, row]}>
          <Text style={[styles.splitLabel, { textAlign, writingDirection, color: colors.text }]}>
            {t('admin.analyticsReviews')}
          </Text>
          <Text style={[styles.splitValue, { color: colors.primary }]}>
            {String(analytics?.totals.review_submit ?? 0)}
          </Text>
        </View>
        {chartDays.length > 0 ? (
          <View style={styles.chartWrap}>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.analyticsChart')}</Text>
            <View style={[styles.chartRow, row]}>
              {chartDays.map((day) => {
                const max = Math.max(1, ...chartDays.map((d) => d.views + d.books));
                const height = Math.max(4, Math.round(((day.views + day.books) / max) * 48));
                return (
                  <View key={day.key} style={styles.chartCol}>
                    <View style={[styles.chartBar, { height, backgroundColor: colors.primary }]} />
                    <Text style={[styles.chartLabel, { color: colors.textMuted }]}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
        {(analytics?.byCampus ?? []).slice(0, 5).map((campusRow) => {
          const uni = universities.find((item) => item.id === campusRow.universityId);
          return (
            <Text key={campusRow.universityId} style={[styles.meta, rtlText, { color: colors.textMuted }]}>
              {localizedName(uni, i18n.language) || campusRow.universityId}: {campusRow.views}{' '}
              {t('admin.analyticsViewsShort')} · {campusRow.books} {t('admin.analyticsBooksShort')} ·{' '}
              {campusRow.conversion}%
            </Text>
          );
        })}
      </Card>

      <Card compact>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.commissionSplit')}</Text>
        {(['cash', 'check', 'visa'] as const).map((method) => (
          <View key={method} style={[styles.splitRow, row]}>
            <Text
              style={[styles.splitLabel, { textAlign, writingDirection, color: colors.text }]}
              numberOfLines={1}
            >
              {t(`payment.${method}`)} · {paySplit[method].count}
            </Text>
            <Text style={[styles.splitValue, { color: colors.primary }]}>{formatIls(paySplit[method].fee, lang)}</Text>
          </View>
        ))}
      </Card>

      <View style={[styles.grid, row]}>
        <StatTile
          icon="shield-checkmark-outline"
          label={t('admin.pendingIds')}
          value={String(pendingIds.length)}
          meta={t('admin.pendingIdsMeta')}
          onPress={() => router.push('/(admin)/verify')}
        />
        <StatTile
          icon="people-outline"
          label={t('admin.pendingOwners')}
          value={String(pendingOwners.length)}
          meta={`${t('admin.owners')}: ${activeOwners}`}
          onPress={() =>
            router.push({ pathname: '/(admin)/(tabs)/users', params: { role: 'owner', owner: 'pending' } })
          }
        />
        <StatTile
          icon="home-outline"
          label={t('admin.pendingListings')}
          value={String(pendingListings.length)}
          meta={`${t('admin.approvedListings')}: ${liveListings}`}
          onPress={() => router.push('/(admin)/(tabs)/listings')}
        />
        <StatTile
          icon="calendar-outline"
          label={t('admin.pendingBookings')}
          value={String(pendingBookings)}
          meta={`${t('admin.bookings')}: ${bookings.length}`}
          onPress={() => router.push('/(admin)/(tabs)/bookings')}
        />
        <StatTile
          icon="school-outline"
          label={t('admin.students')}
          value={String(students)}
          meta={`${t('admin.renters')}: ${renters}`}
          onPress={() => router.push({ pathname: '/(admin)/(tabs)/users', params: { role: 'student' } })}
        />
        <StatTile
          icon="flag-outline"
          label={t('admin.reportsTitle')}
          value={String(pendingCounts.reports)}
          meta={t('admin.reportsMeta')}
          onPress={() => router.push('/(admin)/reports')}
        />
      </View>

      <Card compact onPress={() => router.push('/(admin)/(tabs)/chat')}>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.inboxTitle')}</Text>
        <Text style={[styles.value, rtlText, { color: colors.primary }]}>{chats}</Text>
        <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.openChat')}</Text>
      </Card>

      <Card compact onPress={() => router.push('/(admin)/catalog')}>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.catalogTitle')}</Text>
        <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.catalogHint')}</Text>
      </Card>

      <Card compact onPress={() => router.push('/(admin)/payouts')}>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.payoutsTitle')}</Text>
        <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.payoutsHint')}</Text>
      </Card>

      <Card compact onPress={() => router.push('/(admin)/reviews')}>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.reviewsTitle')}</Text>
        <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.reviewsHint')}</Text>
      </Card>

      <Text style={[styles.section, rtlText, { color: colors.text }]}>{t('admin.pendingIds')}</Text>
      {pendingIds.length === 0 ? <EmptyState title={t('admin.idReviewEmpty')} /> : null}
      {pendingIds.slice(0, 6).map((user) => (
        <Card key={user.id} compact>
          <Text style={[styles.name, rtlText, { color: colors.text }]}>{user.full_name || user.email}</Text>
          <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
            {t(`roles.${user.role}`)} · {user.email}
          </Text>
          <View style={[styles.row, row]}>
            <View style={styles.flex}>
              <Button title={t('admin.reviewId')} onPress={() => router.push('/(admin)/verify')} pill />
            </View>
            <View style={styles.flex}>
              <Button
                title={t('admin.editUser')}
                variant="secondary"
                pill
                onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: user.id } })}
              />
            </View>
          </View>
        </Card>
      ))}

      <Text style={[styles.section, rtlText, { color: colors.text }]}>{t('admin.pendingOwners')}</Text>
      {pendingOwners.length === 0 ? <EmptyState title={t('admin.noPending')} /> : null}
      {pendingOwners.slice(0, 6).map((owner) => (
        <Card key={owner.id} compact>
          <Text style={[styles.name, rtlText, { color: colors.text }]}>{owner.full_name || owner.email}</Text>
          <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{owner.email}</Text>
          <View style={[styles.row, row]}>
            <View style={styles.flex}>
              <Button title={t('admin.approveAlways')} onPress={() => void setOwnerStatus(owner.id, 'approved')} pill />
            </View>
            <View style={styles.flex}>
              <Button
                title={t('admin.reject')}
                variant="danger"
                onPress={() => void setOwnerStatus(owner.id, 'rejected')}
                pill
              />
            </View>
          </View>
          <Button
            title={t('admin.editUser')}
            variant="ghost"
            pill
            onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: owner.id } })}
          />
        </Card>
      ))}
      {pendingOwners.length > 6 ? (
        <Button
          title={t('admin.seeAll')}
          variant="secondary"
          pill
          onPress={() =>
            router.push({ pathname: '/(admin)/(tabs)/users', params: { role: 'owner', owner: 'pending' } })
          }
        />
      ) : null}

      <Text style={[styles.section, rtlText, { color: colors.text }]}>{t('admin.pendingListings')}</Text>
      {pendingListings.length === 0 ? <EmptyState title={t('admin.noPending')} /> : null}
      {pendingListings.slice(0, 6).map((item) => (
        <Card key={item.id} compact>
          <Text style={[styles.name, rtlText, { color: colors.text }]}>{localizedTitle(item, i18n.language)}</Text>
          <View style={[styles.row, row]}>
            <View style={styles.flex}>
              <Button
                title={t('admin.review')}
                variant="secondary"
                pill
                onPress={() => router.push({ pathname: '/(admin)/apartment/[id]', params: { id: item.id } })}
              />
            </View>
            <View style={styles.flex}>
              <Button title={t('admin.approve')} pill onPress={() => void setListingStatus(item)} />
            </View>
            <View style={styles.flex}>
              <Button
                title={t('admin.reject')}
                variant="danger"
                pill
                onPress={() => {
                  setRejectNote('');
                  setRejecting(item);
                }}
              />
            </View>
          </View>
        </Card>
      ))}
      {pendingListings.length > 6 ? (
        <Button
          title={t('admin.seeAll')}
          variant="secondary"
          pill
          onPress={() => router.push('/(admin)/(tabs)/listings')}
        />
      ) : null}
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
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginBottom: -8 },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: 'hidden',
    gap: 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  heroLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontFamily: 'Cairo_700Bold' },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroMeta: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontFamily: 'Cairo_400Regular' },
  section: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginTop: 4 },
  label: { fontWeight: '700', fontFamily: 'Cairo_700Bold', fontSize: 13 },
  value: { fontSize: 24, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  meta: { fontFamily: 'Cairo_400Regular', fontSize: 12 },
  name: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  grid: { flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm + 2,
    gap: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileLabel: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  tileValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  tileMeta: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  row: { gap: 8 },
  flex: { flex: 1 },
  splitRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    gap: 12,
  },
  splitLabel: { flex: 1, minWidth: 0, fontFamily: 'Cairo_400Regular' },
  splitValue: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', flexShrink: 0 },
  chartWrap: { gap: 8, paddingTop: 8 },
  chartRow: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 2,
    minHeight: 64,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartBar: { width: '70%', minWidth: 4, maxWidth: 14, borderRadius: 4 },
  chartLabel: { fontSize: 8, fontFamily: 'Cairo_400Regular' },
});
