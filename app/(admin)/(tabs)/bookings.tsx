import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { bookingStatusLabel, formatIls, localizedName } from '@/src/lib/format';
import { seekerIcon, seekerRoleLabel } from '@/src/lib/seeker';
import { alert } from '@/src/lib/notice';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Booking, BookingStatus, PaymentStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function AdminBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row, lang } = useLayout();
  const colors = useColors();
  const { universities } = useCatalog();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select(
        '*, apartments(*, cities(*)), student:profiles!student_id(id, full_name, phone, email, whatsapp, gender, university_id, city_id, role), owner:profiles!owner_id(id, full_name, phone, email)',
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

  const counts = useMemo(() => {
    const next: Record<Filter, number> = {
      all: bookings.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const item of bookings) next[item.status] += 1;
    return next;
  }, [bookings]);

  const visible = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((item) => item.status === filter)),
    [bookings, filter],
  );

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <Screen>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.bookings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.bookings')}</Text>
        </View>
        {counts.pending > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <Text style={[styles.countText, { color: colors.warning }]}>{counts.pending}</Text>
          </View>
        ) : null}
      </View>
      <FilterPills
        value={filter}
        onChange={setFilter}
        items={filters.map((value) => ({
          value,
          label: value === 'all' ? t('common.all') : bookingStatusLabel(value, t),
          count: counts[value],
        }))}
      />
      {visible.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="calendar-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, rtlText, { color: colors.textMuted }]}>{t('booking.emptyFiltered')}</Text>
        </View>
      ) : null}
      {visible.map((booking) => {
        const student = booking.student;
        const gender =
          student?.gender === 'male' ? t('profile.male') : student?.gender === 'female' ? t('profile.female') : '';
        const university = localizedName(
          universities.find((item) => item.id === student?.university_id),
          i18n.language,
        );
        const personBits = [
          student?.full_name,
          gender,
          seekerRoleLabel(student?.role, t),
          booking.owner?.full_name,
        ].filter(Boolean);
        const extraBits = [
          university,
          `${t('admin.commission')}: ${formatIls(Number(booking.commission_amount), lang)}`,
        ].filter(Boolean);
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            personIcon={seekerIcon(student?.role)}
            personLabel={personBits.join(' · ') || undefined}
            extra={extraBits.join(' · ')}
            note={
              booking.status === 'cancelled' && booking.cancel_reason
                ? t('booking.cancelledNote', { note: booking.cancel_reason })
                : undefined
            }
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
  top: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  countPill: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  countText: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: 24,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
});
