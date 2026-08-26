import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DateField } from '@/components/ui/DateField';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { occupantChoices } from '@/src/lib/booking';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { notifyUser } from '@/src/lib/push';
import { isStudentReady, listingFitsStudent } from '@/src/lib/studentProfile';
import { supabase } from '@/src/lib/supabase';
import { colors, radius } from '@/src/theme/colors';
import type { Apartment, PaymentMethod } from '@/src/types/database';

const MONTHS = [1, 2, 3, 4, 6, 12];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return isoDate(date);
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, lang } = useLayout();
  const { profile } = useAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [missing, setMissing] = useState(false);
  const [startDate, setStartDate] = useState(defaultStart());
  const [months, setMonths] = useState(1);
  const [occupants, setOccupants] = useState(1);
  const [percent, setPercent] = useState(10);
  const [method, setMethod] = useState<PaymentMethod>('pay_now');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('commission_percent')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.commission_percent != null) setPercent(Number(data.commission_percent));
      });
  }, []);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('apartments')
      .select('*, cities(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const next = data as Apartment;
          setApartment(next);
          setOccupants((current) => Math.min(current, occupantChoices(next.rooms).length));
        } else setMissing(true);
      });
  }, [id]);

  const today = isoDate(new Date());
  const people = occupantChoices(apartment?.rooms);
  const headcount = Math.min(occupants, people.length || 1);
  const total = apartment ? apartment.price_month * months : 0;
  const commission = Math.round(total * percent * headcount) / 100;
  const photo = apartment?.photos[0];
  const city = apartment ? localizedName(apartment.cities, i18n.language) : '';

  const submit = async () => {
    if (!profile || !apartment) return;
    if (!isStudentReady(profile)) {
      alert(t('booking.needProfile'), t('profile.completeToBook'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.title'), onPress: () => router.replace('/(student)/(tabs)/profile') },
      ]);
      return;
    }
    if (!listingFitsStudent(apartment.gender_policy, profile.gender)) {
      alert(t('common.error'), t('listing.genderMismatch'));
      return;
    }
    if (startDate < today) {
      alert(t('common.error'), t('booking.pastDate'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        apartment_id: apartment.id,
        student_id: profile.id,
        owner_id: apartment.owner_id,
        start_date: startDate,
        months,
        occupants: headcount,
        payment_method: method,
        rent_amount: total,
        commission_percent: 0,
        commission_amount: 0,
      });
      if (error) throw error;
      void notifyUser(apartment.owner_id, t('push.bookingRequestTitle'), t('push.bookingRequestBody'));
      alert(t('booking.success'), t('booking.successBody'), [
        { text: t('common.done'), onPress: () => router.replace('/(student)/(tabs)/bookings') },
      ]);
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  if (!apartment) {
    return (
      <Screen back>
        {missing ? (
          <Text style={[styles.sub, rtlText]}>{t('listing.notFound')}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  return (
    <Screen back>
      <Text style={[styles.title, rtlText]}>{t('booking.title')}</Text>
      <Card>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" /> : null}
        <Text style={[styles.sub, rtlText]}>{localizedTitle(apartment, i18n.language)}</Text>
        {city ? <Text style={[styles.body, rtlText]}>{city}</Text> : null}
        <DateField label={t('booking.startDate')} value={startDate} onChange={setStartDate} kind="booking" />
        <Text style={[styles.label, rtlText]}>{t('booking.occupants')}</Text>
        <Text style={[styles.hint, rtlText]}>{t('booking.occupantsHint')}</Text>
        <View style={[styles.chips, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
          {people.map((value) => (
            <Chip
              key={value}
              label={value === 1 ? t('booking.onePerson') : t('booking.people', { count: value })}
              selected={headcount === value}
              onPress={() => setOccupants(value)}
            />
          ))}
        </View>
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
        <Text style={[styles.body, rtlText]}>
          {t('booking.occupants')}: {headcount === 1 ? t('booking.onePerson') : t('booking.people', { count: headcount })}
        </Text>
        <Text style={[styles.body, rtlText]}>
          {t('booking.commission')}: {formatIls(commission, lang)} ({percent}% × {headcount})
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
  hint: { color: colors.textMuted, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20, marginTop: -4 },
  body: { color: colors.text, fontSize: 16, fontFamily: 'Cairo_400Regular' },
  total: { color: colors.primary, fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
});
