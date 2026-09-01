import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { bookingStatusLabel } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { whatsappLink } from '@/src/lib/phone';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, Booking, BookingStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function OwnerBookings() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, apartments(*, cities(*)), profiles!student_id(id, full_name, phone, email, whatsapp)')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  const messageStudent = async (booking: Booking) => {
    if (!booking.apartments || !booking.student_id) return;
    setBusyId(booking.id);
    try {
      const conversationId = await openConversation(booking.apartments as Apartment, booking.student_id);
      router.push({ pathname: '/(owner)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <Screen>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.bookings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('booking.incoming')}</Text>
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
        const phone = booking.profiles?.phone;
        const whatsapp = booking.profiles?.whatsapp || phone;
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            personIcon="school"
            personLabel={booking.profiles?.full_name}
          >
            {booking.status === 'pending' ? (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button title={t('admin.approve')} pill onPress={() => updateStatus(booking.id, 'confirmed')} />
                </View>
                <View style={styles.flex}>
                  <Button
                    title={t('admin.reject')}
                    variant="danger"
                    pill
                    onPress={() => updateStatus(booking.id, 'cancelled')}
                  />
                </View>
              </View>
            ) : null}
            {booking.status === 'confirmed' ? (
              <Button title={t('booking.complete')} pill onPress={() => updateStatus(booking.id, 'completed')} />
            ) : null}
            <Button
              title={t('booking.messageStudent')}
              variant="secondary"
              pill
              loading={busyId === booking.id}
              onPress={() => void messageStudent(booking)}
            />
            {phone ? (
              <Button title={t('common.call')} variant="ghost" pill onPress={() => Linking.openURL(`tel:${phone}`)} />
            ) : null}
            {whatsapp ? (
              <Button
                title={t('profile.openWhatsapp')}
                variant="ghost"
                pill
                onPress={() => Linking.openURL(whatsappLink(whatsapp))}
              />
            ) : null}
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
  actions: { flexDirection: 'row', gap: 8 },
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
