import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { bookingStatusLabel, formatIls, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Booking } from '@/src/types/database';

export default function OwnerBookings() {
  const { t, i18n } = useTranslation();
  const { textAlign, lang, row } = useLayout();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, apartments(*, cities(*)), profiles!student_id(id, full_name, phone, email)')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('booking.incoming')}</Text>
      {bookings.length === 0 ? <EmptyState title={t('booking.empty')} /> : null}
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <Text style={[styles.name, { textAlign }]}>{localizedTitle(booking.apartments, i18n.language)}</Text>
          <Text style={[styles.meta, { textAlign }]}>{booking.profiles?.full_name}</Text>
          <StatusBadge
            label={bookingStatusLabel(booking.status, t)}
            tone={booking.status === 'confirmed' ? 'approved' : booking.status === 'cancelled' ? 'rejected' : 'pending'}
          />
          <Text style={[styles.meta, { textAlign }]}>
            {formatIls(booking.rent_amount, lang)} · {t(`payment.${booking.payment_method}`)} · {t(`payment.${booking.payment_status}`)}
          </Text>
          {booking.status === 'pending' ? (
            <View style={[styles.actions, row]}>
              <View style={styles.flex}>
                <Button title={t('admin.approve')} onPress={() => updateStatus(booking.id, 'confirmed')} />
              </View>
              <View style={styles.flex}>
                <Button title={t('admin.reject')} variant="danger" onPress={() => updateStatus(booking.id, 'cancelled')} />
              </View>
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { color: colors.textMuted },
  actions: { gap: 8 },
  flex: { flex: 1 },
});
