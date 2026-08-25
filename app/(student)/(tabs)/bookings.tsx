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
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { bookingStatusLabel } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Apartment, Booking, BookingStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function StudentBookings() {
  const { t } = useTranslation();
  const { rtlText, isRtl } = useLayout();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, apartments(*, cities(*)), profiles!owner_id(id, full_name, phone)')
      .eq('student_id', profile.id)
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

  const cancel = (id: string) => {
    alert(t('booking.cancelRequest'), t('booking.confirmCancel'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const messageOwner = async (booking: Booking) => {
    if (!profile || !booking.apartments) return;
    setBusyId(booking.id);
    try {
      const conversationId = await openConversation(booking.apartments as Apartment, profile.id);
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('tabs.bookings')}</Text>
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
          <Text style={[styles.emptyText, rtlText]}>
            {bookings.length === 0 ? t('booking.empty') : t('booking.emptyFiltered')}
          </Text>
          {bookings.length === 0 ? (
            <Button title={t('booking.findPlace')} onPress={() => router.push('/(student)/(tabs)/search')} pill />
          ) : null}
        </View>
      ) : null}
      {visible.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          personIcon="home"
          personLabel={booking.profiles?.full_name ? `${t('listing.owner')}: ${booking.profiles.full_name}` : undefined}
        >
          {booking.apartment_id ? (
            <Button
              title={t('booking.viewListing')}
              variant="secondary"
              pill
              onPress={() =>
                router.push({ pathname: '/(student)/apartment/[id]', params: { id: booking.apartment_id } })
              }
            />
          ) : null}
          <Button
            title={t('booking.messageOwner')}
            variant="ghost"
            pill
            loading={busyId === booking.id}
            onPress={() => void messageOwner(booking)}
          />
          {booking.status === 'pending' ? (
            <Button title={t('booking.cancelRequest')} variant="danger" pill onPress={() => cancel(booking.id)} />
          ) : null}
        </BookingCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
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
