import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoteModal } from '@/components/ui/NoteModal';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { paymentBucket } from '@/src/lib/booking';
import { formatIls, localizedTitle } from '@/src/lib/format';
import { updateListingStatus } from '@/src/lib/listing';
import { notifyListingApproved, notifyListingRejected } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
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
  const [owners, setOwners] = useState<Profile[]>([]);
  const [students, setStudents] = useState(0);
  const [renters, setRenters] = useState(0);
  const [listings, setListings] = useState<Apartment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [chats, setChats] = useState(0);
  const [rejecting, setRejecting] = useState<Apartment | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [profileRes, listingRes, bookingRes, chatRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, owner_status, phone'),
      supabase.from('apartments').select('id, title_ar, title_en, status, owner_id, reject_reason'),
      supabase.from('bookings').select('id, status, commission_amount, payment_method, created_at'),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
    ]);
    const profiles = (profileRes.data as Profile[]) ?? [];
    setStudents(profiles.filter((item) => item.role === 'student').length);
    setRenters(profiles.filter((item) => item.role === 'renter').length);
    setOwners(profiles.filter((item) => item.role === 'owner'));
    setListings((listingRes.data as Apartment[]) ?? []);
    setBookings((bookingRes.data as Booking[]) ?? []);
    setChats(chatRes.count ?? 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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
    <Screen>
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

      <Card>
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
      </View>

      <Card onPress={() => router.push('/(admin)/(tabs)/chat')}>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.inboxTitle')}</Text>
        <Text style={[styles.value, rtlText, { color: colors.primary }]}>{chats}</Text>
        <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.openChat')}</Text>
      </Card>

      <Card onPress={() => router.push('/(admin)/(tabs)/catalog')}>
        <Text style={[styles.label, rtlText, { color: colors.textMuted }]}>{t('admin.catalogTitle')}</Text>
        <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.catalogHint')}</Text>
        <Button title={t('admin.openCatalog')} variant="secondary" onPress={() => router.push('/(admin)/(tabs)/catalog')} />
      </Card>

      <Text style={[styles.section, rtlText, { color: colors.text }]}>{t('admin.pendingOwners')}</Text>
      {pendingOwners.length === 0 ? <EmptyState title={t('admin.noPending')} /> : null}
      {pendingOwners.slice(0, 6).map((owner) => (
        <Card key={owner.id}>
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
        <Card key={item.id}>
          <Text style={[styles.name, rtlText, { color: colors.text }]}>{localizedTitle(item, i18n.language)}</Text>
          <View style={[styles.row, row]}>
            <View style={styles.flex}>
              <Button title={t('admin.review')} variant="secondary" onPress={() => router.push({ pathname: '/(admin)/apartment/[id]', params: { id: item.id } })} />
            </View>
            <View style={styles.flex}>
              <Button title={t('admin.approve')} onPress={() => void setListingStatus(item)} />
            </View>
          </View>
          <Button
            title={t('admin.reject')}
            variant="danger"
            onPress={() => {
              setRejectNote('');
              setRejecting(item);
            }}
          />
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
        onChange={setRejectNote}
        onConfirm={() => rejecting && void setListingStatus(rejecting, 'rejected', rejectNote)}
        onClose={() => setRejecting(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginBottom: -8 },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hero: {
    borderRadius: 28,
    padding: spacing.lg,
    overflow: 'hidden',
    gap: 4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  heroLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: 'Cairo_700Bold' },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroMeta: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontFamily: 'Cairo_400Regular' },
  section: { fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginTop: 8 },
  label: { fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  value: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  meta: { fontFamily: 'Cairo_400Regular' },
  name: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  grid: { flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  tileValue: { fontSize: 24, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  tileMeta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
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
});
