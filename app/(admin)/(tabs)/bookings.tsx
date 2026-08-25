import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { bookingStatusLabel, formatIls, localizedTitle } from '@/src/lib/format';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Booking, BookingStatus, PaymentStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

function formatDate(iso: string, lang: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(lang.startsWith('ar') ? 'ar' : 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function bookingTone(status: BookingStatus) {
  if (status === 'confirmed' || status === 'completed') return 'approved' as const;
  if (status === 'cancelled') return 'rejected' as const;
  return 'pending' as const;
}

export default function AdminBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart, lang } = useLayout();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select(
        '*, apartments(*, cities(*)), student:profiles!student_id(id, full_name, phone, email, whatsapp), owner:profiles!owner_id(id, full_name, phone, email)',
      )
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateStatus = async (id: string, status: BookingStatus) => {
    const booking = bookings.find((item) => item.id === id);
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else {
      if (status === 'confirmed' && booking?.student_id) {
        void notifyUser(booking.student_id, t('push.bookingApprovedTitle'), t('push.bookingApprovedBody'));
      }
      void load();
    }
  };

  const updatePayment = async (id: string, payment_status: PaymentStatus) => {
    const { error } = await supabase.from('bookings').update({ payment_status }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  const visible = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((item) => item.status === filter)),
    [bookings, filter],
  );

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('admin.bookings')}</Text>
      <View style={[styles.chips, { justifyContent: alignStart }]}>
        {filters.map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? t('common.all') : bookingStatusLabel(value, t)}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>
      {visible.length === 0 ? <EmptyState title={t('booking.empty')} /> : null}
      {visible.map((booking) => (
        <Card key={booking.id}>
          <Text style={[styles.name, rtlText]}>{localizedTitle(booking.apartments, i18n.language)}</Text>
          {booking.student?.full_name ? (
            <Text style={[styles.meta, rtlText]}>
              {t('admin.studentName')}: {booking.student.full_name}
            </Text>
          ) : null}
          {booking.owner?.full_name ? (
            <Text style={[styles.meta, rtlText]}>
              {t('admin.ownerName')}: {booking.owner.full_name}
            </Text>
          ) : null}
          <StatusBadge label={bookingStatusLabel(booking.status, t)} tone={bookingTone(booking.status)} />
          <Text style={[styles.meta, rtlText]}>
            {formatIls(booking.rent_amount, lang)} · {t(`payment.${booking.payment_method}`)} · {t(`payment.${booking.payment_status}`)}
          </Text>
          <Text style={[styles.meta, rtlText]}>
            {t('admin.commission')}: {formatIls(Number(booking.commission_amount), lang)}
          </Text>
          <Text style={[styles.meta, rtlText]}>
            {formatDate(booking.start_date, i18n.language)} · {booking.months}{' '}
            {booking.months === 1 ? t('common.month') : t('common.months')}
          </Text>
          {booking.status === 'pending' ? (
            <View style={[styles.row, { justifyContent: alignStart }]}>
              <View style={styles.flex}>
                <Button title={t('admin.approve')} onPress={() => void updateStatus(booking.id, 'confirmed')} />
              </View>
              <View style={styles.flex}>
                <Button title={t('admin.reject')} variant="danger" onPress={() => void updateStatus(booking.id, 'cancelled')} />
              </View>
            </View>
          ) : null}
          {booking.status === 'confirmed' ? (
            <Button title={t('booking.complete')} onPress={() => void updateStatus(booking.id, 'completed')} />
          ) : null}
          {booking.payment_status === 'unpaid' && booking.status !== 'cancelled' ? (
            <Button title={t('admin.markPaid')} variant="secondary" onPress={() => void updatePayment(booking.id, 'paid')} />
          ) : null}
          {booking.payment_status === 'paid' && booking.status !== 'cancelled' ? (
            <Button title={t('admin.markUnpaid')} variant="ghost" onPress={() => void updatePayment(booking.id, 'unpaid')} />
          ) : null}
          {booking.apartment_id ? (
            <Button
              title={t('booking.viewListing')}
              variant="ghost"
              onPress={() => router.push({ pathname: '/(admin)/apartment/[id]', params: { id: booking.apartment_id } })}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { color: colors.textMuted },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
