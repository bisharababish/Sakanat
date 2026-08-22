import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { bookingStatusLabel, formatIls, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Booking } from '@/src/types/database';

export default function StudentBookings() {
  const { t, i18n } = useTranslation();
  const { textAlign, lang } = useLayout();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, apartments(*, cities(*))')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('tabs.bookings')}</Text>
      {bookings.length === 0 ? <EmptyState title={t('booking.empty')} /> : null}
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <Text style={[styles.name, { textAlign }]}>{localizedTitle(booking.apartments, i18n.language)}</Text>
          <StatusBadge
            label={bookingStatusLabel(booking.status, t)}
            tone={booking.status === 'confirmed' ? 'approved' : booking.status === 'cancelled' ? 'rejected' : 'pending'}
          />
          <Text style={[styles.meta, { textAlign }]}>
            {formatIls(booking.rent_amount, lang)} · {t(`payment.${booking.payment_method}`)} · {t(`payment.${booking.payment_status}`)}
          </Text>
          <Text style={[styles.meta, { textAlign }]}>
            {booking.start_date} · {booking.months} {t('common.months')}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { color: colors.textMuted },
});
