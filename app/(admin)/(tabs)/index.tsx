import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { formatIls } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, Booking, Profile } from '@/src/types/database';

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export default function AdminOverview() {
  const { t } = useTranslation();
  const { textAlign, lang } = useLayout();
  const [owners, setOwners] = useState<Profile[]>([]);
  const [listings, setListings] = useState<Apartment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([
        supabase.from('profiles').select('*').eq('role', 'owner').eq('owner_status', 'pending'),
        supabase.from('apartments').select('*').eq('status', 'pending'),
        supabase.from('bookings').select('*'),
      ]).then(([ownerRes, listingRes, bookingRes]) => {
        setOwners((ownerRes.data as Profile[]) ?? []);
        setListings((listingRes.data as Apartment[]) ?? []);
        setBookings((bookingRes.data as Booking[]) ?? []);
      });
    }, []),
  );

  const monthly = useMemo(
    () =>
      bookings
        .filter((item) => isThisMonth(item.created_at) && item.status !== 'cancelled')
        .reduce((sum, item) => sum + Number(item.commission_amount), 0),
    [bookings],
  );

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('admin.overview')}</Text>
      <Card>
        <Text style={[styles.label, { textAlign }]}>{t('admin.monthlyCommission')}</Text>
        <Text style={[styles.value, { textAlign }]}>{formatIls(monthly, lang)}</Text>
      </Card>
      <Card>
        <Text style={[styles.label, { textAlign }]}>{t('admin.pendingOwners')}</Text>
        <Text style={[styles.value, { textAlign }]}>{owners.length}</Text>
      </Card>
      <Card>
        <Text style={[styles.label, { textAlign }]}>{t('admin.pendingListings')}</Text>
        <Text style={[styles.value, { textAlign }]}>{listings.length}</Text>
      </Card>
      <Card>
        <Text style={[styles.label, { textAlign }]}>{t('admin.bookings')}</Text>
        <Text style={[styles.value, { textAlign }]}>{bookings.length}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  label: { color: colors.textMuted, fontWeight: '700' },
  value: { fontSize: 28, fontWeight: '800', color: colors.primary },
});
