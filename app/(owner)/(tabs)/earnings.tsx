import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { formatIls, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Booking } from '@/src/types/database';

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export default function OwnerEarnings() {
  const { t, i18n } = useTranslation();
  const { rtlText, lang } = useLayout();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      supabase
        .from('bookings')
        .select('*, apartments(title_ar, title_en)')
        .eq('owner_id', profile.id)
        .in('status', ['confirmed', 'completed'])
        .order('created_at', { ascending: false })
        .then(({ data }) => setBookings((data as Booking[]) ?? []));
    }, [profile]),
  );

  const stats = useMemo(() => {
    const allGross = bookings.reduce((sum, item) => sum + Number(item.rent_amount), 0);
    const allCommission = bookings.reduce((sum, item) => sum + Number(item.commission_amount), 0);
    const month = bookings.filter((item) => isThisMonth(item.created_at));
    const monthGross = month.reduce((sum, item) => sum + Number(item.rent_amount), 0);
    const monthCommission = month.reduce((sum, item) => sum + Number(item.commission_amount), 0);
    return { allGross, allCommission, monthGross, monthCommission, monthCount: month.length, allCount: bookings.length };
  }, [bookings]);

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('owner.earningsTitle')}</Text>
      {bookings.length === 0 ? <EmptyState title={t('booking.empty')} /> : null}
      <Card>
        <Text style={[styles.label, rtlText]}>{t('owner.thisMonth')}</Text>
        <Text style={[styles.meta, rtlText]}>
          {t('owner.gross')}: {formatIls(stats.monthGross, lang)}
        </Text>
        <Text style={[styles.meta, rtlText]}>
          {t('owner.commission')}: {formatIls(stats.monthCommission, lang)}
        </Text>
        <Text style={[styles.net, rtlText]}>
          {t('owner.net')}: {formatIls(stats.monthGross - stats.monthCommission, lang)}
        </Text>
      </Card>
      <Card>
        <Text style={[styles.label, rtlText]}>{t('owner.allTime')}</Text>
        <Text style={[styles.meta, rtlText]}>
          {t('owner.gross')}: {formatIls(stats.allGross, lang)}
        </Text>
        <Text style={[styles.meta, rtlText]}>
          {t('owner.commission')}: {formatIls(stats.allCommission, lang)}
        </Text>
        <Text style={[styles.net, rtlText]}>
          {t('owner.net')}: {formatIls(stats.allGross - stats.allCommission, lang)}
        </Text>
      </Card>
      {bookings.slice(0, 8).map((booking) => (
        <Card key={booking.id}>
          <Text style={[styles.item, rtlText]}>{localizedTitle(booking.apartments, i18n.language)}</Text>
          <Text style={[styles.meta, rtlText]}>
            {formatIls(Number(booking.rent_amount) - Number(booking.commission_amount), lang)} · {t(`bookingStatus.${booking.status}`)}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  label: { fontWeight: '800', color: colors.text, fontSize: 16 },
  meta: { color: colors.textMuted },
  net: { color: colors.primary, fontWeight: '800', fontSize: 20 },
  item: { fontWeight: '700', color: colors.text },
});
