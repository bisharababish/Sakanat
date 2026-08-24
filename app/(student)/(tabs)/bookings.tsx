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
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { bookingStatusLabel, formatIls, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, Booking, BookingStatus } from '@/src/types/database';

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

export default function StudentBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart, lang } = useLayout();
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
    Alert.alert(t('booking.cancelRequest'), t('booking.confirmCancel'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
          if (error) Alert.alert(t('common.error'), error.message);
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
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'cancelled'];

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('tabs.bookings')}</Text>
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
          {booking.profiles?.full_name ? (
            <Text style={[styles.meta, rtlText]}>
              {t('listing.owner')}: {booking.profiles.full_name}
            </Text>
          ) : null}
          <StatusBadge
            label={bookingStatusLabel(booking.status, t)}
            tone={booking.status === 'confirmed' ? 'approved' : booking.status === 'cancelled' ? 'rejected' : 'pending'}
          />
          <Text style={[styles.meta, rtlText]}>
            {formatIls(booking.rent_amount, lang)} · {t(`payment.${booking.payment_method}`)} · {t(`payment.${booking.payment_status}`)}
          </Text>
          <Text style={[styles.meta, rtlText]}>
            {formatDate(booking.start_date, i18n.language)} · {booking.months}{' '}
            {booking.months === 1 ? t('common.month') : t('common.months')}
          </Text>
          <View style={styles.actions}>
            {booking.apartment_id ? (
              <Button
                title={t('booking.viewListing')}
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/(student)/apartment/[id]', params: { id: booking.apartment_id } })
                }
              />
            ) : null}
            <Button
              title={t('booking.messageOwner')}
              variant="ghost"
              loading={busyId === booking.id}
              onPress={() => void messageOwner(booking)}
            />
            {booking.status === 'pending' ? (
              <Button title={t('booking.cancelRequest')} variant="danger" onPress={() => cancel(booking.id)} />
            ) : null}
          </View>
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
  actions: { gap: 8, marginTop: 4 },
});
