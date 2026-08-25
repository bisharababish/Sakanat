import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { bookingStatusLabel } from '@/src/lib/format';
import { whatsappLink } from '@/src/lib/phone';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Apartment, Booking, BookingStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function OwnerBookings() {
  const { t } = useTranslation();
  const { rtlText, isRtl } = useLayout();
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

  const visible = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((item) => item.status === filter)),
    [bookings, filter],
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

  const messageStudent = async (booking: Booking) => {
    if (!booking.apartments || !booking.student_id) return;
    setBusyId(booking.id);
    try {
      const conversationId = await openConversation(booking.apartments as Apartment, booking.student_id);
      router.push({ pathname: '/(owner)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('booking.incoming')}</Text>
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
              <View style={styles.row}>
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
