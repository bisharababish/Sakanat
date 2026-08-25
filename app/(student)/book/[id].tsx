import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DateField } from '@/components/ui/DateField';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { formatIls, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors, radius } from '@/src/theme/colors';
import type { Apartment, PaymentMethod } from '@/src/types/database';

const MONTHS = [1, 2, 3, 4, 6, 12];

function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, lang } = useLayout();
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
  const photo = apartment.photos[0];

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
    <Screen back>
      <Text style={[styles.title, rtlText]}>{t('booking.title')}</Text>
      <Card>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" /> : null}
        <Text style={[styles.sub, rtlText]}>{localizedTitle(apartment, i18n.language)}</Text>
        <DateField label={t('booking.startDate')} value={startDate} onChange={setStartDate} kind="booking" />
        <Text style={[styles.label, rtlText]}>{t('booking.duration')}</Text>
        <View style={[styles.chips, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
          {MONTHS.map((value) => (
            <Chip
              key={value}
              label={`${value} ${value === 1 ? t('common.month') : t('common.months')}`}
              selected={months === value}
              onPress={() => setMonths(value)}
            />
          ))}
        </View>
        <Text style={[styles.label, rtlText]}>{t('booking.method')}</Text>
        <View style={[styles.chips, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
          <Chip label={t('payment.pay_now')} selected={method === 'pay_now'} onPress={() => setMethod('pay_now')} />
          <Chip label={t('payment.pay_later')} selected={method === 'pay_later'} onPress={() => setMethod('pay_later')} />
        </View>
        <Text style={[styles.note, rtlText]}>{t('payment.simulated')}</Text>
      </Card>
      <Card>
        <SectionHead icon="receipt-outline" title={t('booking.summary')} />
        <Text style={[styles.body, rtlText]}>
          {t('booking.rent')}: {formatIls(apartment.price_month, lang)} × {months}
        </Text>
        <Text style={[styles.total, rtlText]}>
          {t('booking.total')}: {formatIls(total, lang)}
        </Text>
      </Card>
      <Button title={t('booking.submit')} onPress={submit} loading={loading} pill />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  photo: { width: '100%', height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  sub: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  label: { fontWeight: '800', fontFamily: 'Cairo_700Bold', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  note: { color: colors.warning, fontSize: 13, fontFamily: 'Cairo_400Regular' },
  body: { color: colors.text, fontSize: 16, fontFamily: 'Cairo_400Regular' },
  total: { color: colors.primary, fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
});
