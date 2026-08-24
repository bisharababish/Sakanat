import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { formatIls, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, Booking, Profile } from '@/src/types/database';

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart, lang } = useLayout();
  const [owners, setOwners] = useState<Profile[]>([]);
  const [students, setStudents] = useState(0);
  const [listings, setListings] = useState<Apartment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const load = useCallback(async () => {
    const [profileRes, listingRes, bookingRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, owner_status, phone'),
      supabase.from('apartments').select('id, title_ar, title_en, status, owner_id'),
      supabase.from('bookings').select('id, status, commission_amount, created_at'),
    ]);
    const profiles = (profileRes.data as Profile[]) ?? [];
    setStudents(profiles.filter((item) => item.role === 'student').length);
    setOwners(profiles.filter((item) => item.role === 'owner'));
    setListings((listingRes.data as Apartment[]) ?? []);
    setBookings((bookingRes.data as Booking[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const earned = useMemo(() => bookings.filter((item) => item.status === 'confirmed' || item.status === 'completed'), [bookings]);
  const monthly = earned.filter((item) => isThisMonth(item.created_at)).reduce((sum, item) => sum + Number(item.commission_amount), 0);
  const allTime = earned.reduce((sum, item) => sum + Number(item.commission_amount), 0);
  const pendingOwners = owners.filter((item) => item.owner_status === 'pending');
  const pendingListings = listings.filter((item) => item.status === 'pending');
  const pendingBookings = bookings.filter((item) => item.status === 'pending').length;
  const liveListings = listings.filter((item) => item.status === 'approved').length;
  const activeOwners = owners.filter((item) => item.owner_status === 'approved').length;

  const setOwnerStatus = async (id: string) => {
    const { error } = await supabase.from('profiles').update({ owner_status: 'approved' }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  const setListingStatus = async (id: string) => {
    const { error } = await supabase.from('apartments').update({ status: 'approved' }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('admin.overview')}</Text>

      <Card onPress={() => router.push('/(admin)/(tabs)/bookings')}>
        <Text style={[styles.label, rtlText]}>{t('admin.monthlyCommission')}</Text>
        <Text style={[styles.value, rtlText]}>{formatIls(monthly, lang)}</Text>
        <Text style={[styles.meta, rtlText]}>
          {t('admin.allTimeCommission')}: {formatIls(allTime, lang)}
        </Text>
      </Card>

      <View style={styles.grid}>
        <View style={styles.tile}>
          <Card onPress={() => router.push('/(admin)/(tabs)/users')}>
            <Text style={[styles.label, rtlText]}>{t('admin.pendingOwners')}</Text>
            <Text style={[styles.value, rtlText]}>{pendingOwners.length}</Text>
            <Text style={[styles.meta, rtlText]}>
              {t('admin.owners')}: {activeOwners}
            </Text>
          </Card>
        </View>
        <View style={styles.tile}>
          <Card onPress={() => router.push('/(admin)/(tabs)/listings')}>
            <Text style={[styles.label, rtlText]}>{t('admin.pendingListings')}</Text>
            <Text style={[styles.value, rtlText]}>{pendingListings.length}</Text>
            <Text style={[styles.meta, rtlText]}>
              {t('admin.approvedListings')}: {liveListings}
            </Text>
          </Card>
        </View>
        <View style={styles.tile}>
          <Card onPress={() => router.push('/(admin)/(tabs)/bookings')}>
            <Text style={[styles.label, rtlText]}>{t('admin.pendingBookings')}</Text>
            <Text style={[styles.value, rtlText]}>{pendingBookings}</Text>
            <Text style={[styles.meta, rtlText]}>
              {t('admin.bookings')}: {bookings.length}
            </Text>
          </Card>
        </View>
        <View style={styles.tile}>
          <Card onPress={() => router.push('/(admin)/(tabs)/users')}>
            <Text style={[styles.label, rtlText]}>{t('admin.students')}</Text>
            <Text style={[styles.value, rtlText]}>{students}</Text>
          </Card>
        </View>
      </View>

      <Text style={[styles.section, rtlText]}>{t('admin.pendingOwners')}</Text>
      {pendingOwners.length === 0 ? <EmptyState title={t('admin.noPending')} /> : null}
      {pendingOwners.slice(0, 6).map((owner) => (
        <Card key={owner.id}>
          <Text style={[styles.name, rtlText]}>{owner.full_name || owner.email}</Text>
          <Text style={[styles.meta, rtlText]}>{owner.email}</Text>
          <Button title={t('admin.approveAlways')} onPress={() => void setOwnerStatus(owner.id)} />
        </Card>
      ))}

      <Text style={[styles.section, rtlText]}>{t('admin.pendingListings')}</Text>
      {pendingListings.length === 0 ? <EmptyState title={t('admin.noPending')} /> : null}
      {pendingListings.slice(0, 6).map((item) => (
        <Card key={item.id}>
          <Text style={[styles.name, rtlText]}>{localizedTitle(item, i18n.language)}</Text>
          <View style={[styles.row, { justifyContent: alignStart }]}>
            <View style={styles.flex}>
              <Button title={t('admin.review')} variant="secondary" onPress={() => router.push({ pathname: '/(admin)/apartment/[id]', params: { id: item.id } })} />
            </View>
            <View style={styles.flex}>
              <Button title={t('admin.approve')} onPress={() => void setListingStatus(item.id)} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  section: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8 },
  label: { color: colors.textMuted, fontWeight: '700' },
  value: { fontSize: 28, fontWeight: '800', color: colors.primary },
  meta: { color: colors.textMuted },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '47%', flexGrow: 1 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
