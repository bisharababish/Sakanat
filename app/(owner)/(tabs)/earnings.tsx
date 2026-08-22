import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { formatIls } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Booking } from '@/src/types/database';

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export default function OwnerEarnings() {
  const { t } = useTranslation();
  const { textAlign, lang } = useLayout();
  const { profile, signOut } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      supabase
        .from('bookings')
        .select('*')
        .eq('owner_id', profile.id)
        .in('status', ['confirmed', 'completed'])
        .then(({ data }) => setBookings((data as Booking[]) ?? []));
    }, [profile]),
  );

  const stats = useMemo(() => {
    const allGross = bookings.reduce((sum, item) => sum + Number(item.rent_amount), 0);
    const allCommission = bookings.reduce((sum, item) => sum + Number(item.commission_amount), 0);
    const month = bookings.filter((item) => isThisMonth(item.created_at));
    const monthGross = month.reduce((sum, item) => sum + Number(item.rent_amount), 0);
    const monthCommission = month.reduce((sum, item) => sum + Number(item.commission_amount), 0);
    return { allGross, allCommission, monthGross, monthCommission };
  }, [bookings]);

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('owner.earningsTitle')}</Text>
      <Card>
        <Text style={[styles.label, { textAlign }]}>{t('owner.thisMonth')}</Text>
        <Text style={[styles.meta, { textAlign }]}>
          {t('owner.gross')}: {formatIls(stats.monthGross, lang)}
        </Text>
        <Text style={[styles.meta, { textAlign }]}>
          {t('owner.commission')}: {formatIls(stats.monthCommission, lang)}
        </Text>
        <Text style={[styles.net, { textAlign }]}>
          {t('owner.net')}: {formatIls(stats.monthGross - stats.monthCommission, lang)}
        </Text>
      </Card>
      <Card>
        <Text style={[styles.label, { textAlign }]}>{t('owner.allTime')}</Text>
        <Text style={[styles.meta, { textAlign }]}>
          {t('owner.gross')}: {formatIls(stats.allGross, lang)}
        </Text>
        <Text style={[styles.meta, { textAlign }]}>
          {t('owner.commission')}: {formatIls(stats.allCommission, lang)}
        </Text>
        <Text style={[styles.net, { textAlign }]}>
          {t('owner.net')}: {formatIls(stats.allGross - stats.allCommission, lang)}
        </Text>
      </Card>
      <LanguageToggle />
      <Button title={t('common.logout')} variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  label: { fontWeight: '800', color: colors.text, fontSize: 16 },
  meta: { color: colors.textMuted },
  net: { color: colors.primary, fontWeight: '800', fontSize: 20 },
});
