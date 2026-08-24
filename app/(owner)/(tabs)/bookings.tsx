import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
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
import { whatsappLink } from '@/src/lib/phone';
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

export default function OwnerBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart, lang } = useLayout();
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
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
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

  const filters: Filter[] = ['all', 'pending', 'confirmed', 'cancelled'];

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('booking.incoming')}</Text>
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
      {visible.map((booking) => {
        const phone = booking.profiles?.phone;
        const whatsapp = booking.profiles?.whatsapp || phone;
        return (
          <Card key={booking.id}>
            <Text style={[styles.name, rtlText]}>{localizedTitle(booking.apartments, i18n.language)}</Text>
            <Text style={[styles.student, rtlText]}>{booking.profiles?.full_name}</Text>
            {phone ? <Text style={[styles.meta, rtlText]}>{phone}</Text> : null}
            <StatusBadge
              label={bookingStatusLabel(booking.status, t)}
              tone={
                booking.status === 'confirmed' || booking.status === 'completed'
                  ? 'approved'
                  : booking.status === 'cancelled'
                    ? 'rejected'
                    : 'pending'
              }
            />
            <Text style={[styles.meta, rtlText]}>
              {formatIls(booking.rent_amount, lang)} · {t(`payment.${booking.payment_method}`)} · {t(`payment.${booking.payment_status}`)}
            </Text>
            <Text style={[styles.meta, rtlText]}>
              {formatDate(booking.start_date, i18n.language)} · {booking.months}{' '}
              {booking.months === 1 ? t('common.month') : t('common.months')}
            </Text>
            {booking.status === 'pending' ? (
              <View style={[styles.row, { justifyContent: alignStart }]}>
                <View style={styles.flex}>
                  <Button title={t('admin.approve')} onPress={() => updateStatus(booking.id, 'confirmed')} />
                </View>
                <View style={styles.flex}>
                  <Button title={t('admin.reject')} variant="danger" onPress={() => updateStatus(booking.id, 'cancelled')} />
                </View>
              </View>
            ) : null}
            {booking.status === 'confirmed' ? (
              <Button title={t('booking.complete')} onPress={() => updateStatus(booking.id, 'completed')} />
            ) : null}
            <Button
              title={t('booking.messageStudent')}
              variant="secondary"
              loading={busyId === booking.id}
              onPress={() => void messageStudent(booking)}
            />
            {phone ? (
              <Button title={t('common.call')} variant="ghost" onPress={() => Linking.openURL(`tel:${phone}`)} />
            ) : null}
            {whatsapp ? (
              <Button
                title={t('profile.openWhatsapp')}
                variant="ghost"
                onPress={() => Linking.openURL(whatsappLink(whatsapp))}
              />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  student: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
