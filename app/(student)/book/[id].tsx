import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { formatIls, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, PaymentMethod } from '@/src/types/database';

const MONTHS = [1, 2, 3, 4, 6, 12];

function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { textAlign, row, lang } = useLayout();
  const { profile } = useAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [startDate, setStartDate] = useState(defaultStart());
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>('pay_now');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('apartments').select('*').eq('id', id).single().then(({ data }) => setApartment(data as Apartment));
  }, [id]);

  if (!apartment) return null;

  const total = apartment.price_month * months;

  const submit = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        apartment_id: apartment.id,
        student_id: profile.id,
        owner_id: apartment.owner_id,
        start_date: startDate,
        months,
        payment_method: method,
        rent_amount: total,
        commission_percent: 0,
        commission_amount: 0,
      });
      if (error) throw error;
      Alert.alert(t('booking.success'), t('booking.successBody'), [
        { text: t('common.done'), onPress: () => router.replace('/(student)/(tabs)/bookings') },
      ]);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('booking.title')}</Text>
      <Text style={[styles.sub, { textAlign }]}>{localizedTitle(apartment, i18n.language)}</Text>
      <Input label={t('booking.startDate')} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
      <Text style={[styles.label, { textAlign }]}>{t('booking.duration')}</Text>
      <View style={[styles.row, row]}>
        {MONTHS.map((value) => (
          <Chip
            key={value}
            label={`${value} ${value === 1 ? t('common.month') : t('common.months')}`}
            selected={months === value}
            onPress={() => setMonths(value)}
          />
        ))}
      </View>
      <Text style={[styles.label, { textAlign }]}>{t('booking.method')}</Text>
      <View style={[styles.row, row]}>
        <Chip label={t('payment.pay_now')} selected={method === 'pay_now'} onPress={() => setMethod('pay_now')} />
        <Chip label={t('payment.pay_later')} selected={method === 'pay_later'} onPress={() => setMethod('pay_later')} />
      </View>
      <Text style={[styles.note, { textAlign }]}>{t('payment.simulated')}</Text>
      <Text style={[styles.label, { textAlign }]}>{t('booking.summary')}</Text>
      <Text style={[styles.body, { textAlign }]}>
        {t('booking.rent')}: {formatIls(apartment.price_month, lang)} × {months}
      </Text>
      <Text style={[styles.total, { textAlign }]}>
        {t('booking.total')}: {formatIls(total, lang)}
      </Text>
      <Button title={t('booking.submit')} onPress={submit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  sub: { color: colors.textMuted, fontSize: 16 },
  label: { fontWeight: '800', color: colors.text },
  row: { flexWrap: 'wrap', gap: 8 },
  note: { color: colors.warning, fontSize: 13 },
  body: { color: colors.text, fontSize: 16 },
  total: { color: colors.primary, fontSize: 20, fontWeight: '800' },
});
