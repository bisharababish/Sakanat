import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { bookingStatusLabel, formatIls } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Booking, BookingStatus, PaymentStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function AdminBookings() {
  const { t } = useTranslation();
  const { rtlText, isRtl, lang } = useLayout();
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
    if (error) alert(t('common.error'), error.message);
    else {
      if (status === 'confirmed' && booking?.student_id) {
        void notifyUser(booking.student_id, t('push.bookingApprovedTitle'), t('push.bookingApprovedBody'));
      }
      void load();
    }
  };

  const updatePayment = async (id: string, payment_status: PaymentStatus) => {
    const { error } = await supabase.from('bookings').update({ payment_status }).eq('id', id);
    if (error) alert(t('common.error'), error.message);
    else void load();
  };

  const removeBooking = (id: string) => {
    alert(t('admin.deleteBooking'), t('admin.confirmDeleteBooking'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('bookings').delete().eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const visible = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((item) => item.status === filter)),
    [bookings, filter],
  );

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('admin.bookings')}</Text>
      <View style={[styles.chips, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
        {filters.map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? t('common.all') : bookingStatusLabel(value, t)}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>
      {visible.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, rtlText]}>{t('booking.emptyFiltered')}</Text>
        </View>
      ) : null}
      {visible.map((booking) => {
        const people = [booking.student?.full_name, booking.owner?.full_name].filter(Boolean).join(' · ');
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            personIcon="people"
            personLabel={people || undefined}
            extra={`${t('admin.commission')}: ${formatIls(Number(booking.commission_amount), lang)}`}
          >
            {booking.status === 'pending' ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button title={t('admin.approve')} pill onPress={() => void updateStatus(booking.id, 'confirmed')} />
                </View>
                <View style={styles.flex}>
                  <Button
                    title={t('admin.reject')}
                    variant="danger"
                    pill
                    onPress={() => void updateStatus(booking.id, 'cancelled')}
                  />
                </View>
              </View>
            ) : null}
            {booking.status === 'confirmed' ? (
              <Button title={t('booking.complete')} pill onPress={() => void updateStatus(booking.id, 'completed')} />
            ) : null}
            {booking.status === 'cancelled' ? (
              <Button
                title={t('admin.restoreBooking')}
                variant="secondary"
                pill
                onPress={() => void updateStatus(booking.id, 'pending')}
              />
            ) : null}
            {booking.status === 'completed' ? (
              <Button
                title={t('admin.restoreBooking')}
                variant="ghost"
                pill
                onPress={() => void updateStatus(booking.id, 'confirmed')}
              />
            ) : null}
            {booking.payment_status === 'unpaid' && booking.status !== 'cancelled' ? (
              <Button
                title={t('admin.markPaid')}
                variant="secondary"
                pill
                onPress={() => void updatePayment(booking.id, 'paid')}
              />
            ) : null}
            {booking.payment_status === 'paid' && booking.status !== 'cancelled' ? (
              <Button
                title={t('admin.markUnpaid')}
                variant="ghost"
                pill
                onPress={() => void updatePayment(booking.id, 'unpaid')}
              />
            ) : null}
            {booking.apartment_id ? (
              <Button
                title={t('booking.viewListing')}
                variant="ghost"
                pill
                onPress={() => router.push({ pathname: '/(admin)/apartment/[id]', params: { id: booking.apartment_id } })}
              />
            ) : null}
            {booking.student_id ? (
              <Button
                title={t('admin.editUser')}
                variant="ghost"
                pill
                onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: booking.student_id } })}
              />
            ) : null}
            <Button title={t('admin.deleteBooking')} variant="danger" pill onPress={() => removeBooking(booking.id)} />
          </BookingCard>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  emptyBox: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
});
