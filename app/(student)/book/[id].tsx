import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { FilterPills } from '@/components/ui/FilterPills';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { occupantChoices, PAYMENT_CHOICES, paymentHintKey, paymentI18nKey } from '@/src/lib/booking';
import { DEFAULT_COMMISSION_PERCENT } from '@/src/lib/commission';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { notifyUser } from '@/src/lib/push';
import { isStudentReady, listingFitsStudent } from '@/src/lib/studentProfile';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
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

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const { rtlText, row } = useLayout();
  const colors = useColors();
  return (
    <View style={[styles.summaryRow, row]}>
      <Text style={[styles.summaryLabel, rtlText, { color: strong ? colors.primary : colors.textMuted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: strong ? colors.primary : colors.text }]}>{value}</Text>
    </View>
  );
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, lang, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [missing, setMissing] = useState(false);
  const [startDate, setStartDate] = useState(defaultStart());
  const [months, setMonths] = useState(1);
  const [occupants, setOccupants] = useState(1);
  const [percent, setPercent] = useState(DEFAULT_COMMISSION_PERCENT);
  const [method, setMethod] = useState<PaymentMethod>('cash');
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
  const ready = isStudentReady(profile);
  const mismatch = Boolean(
    apartment && profile?.gender && !listingFitsStudent(apartment.gender_policy, profile.gender),
  );
  const canSubmit = ready && !mismatch;

  const goProfile = () => {
    router.push({
      pathname: '/(student)/(tabs)/profile',
      params: apartment ? { resumeBook: apartment.id } : undefined,
    });
  };

  const submit = async () => {
    if (!profile || !apartment) return;
    if (!isStudentReady(profile)) {
      alert(t('booking.needProfile'), t('profile.completeToBook'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.title'), onPress: goProfile },
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
    const place = async () => {
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
        const visa = method === 'visa' || method === 'pay_now';
        alert(t('booking.success'), visa ? t('booking.successVisa') : t('booking.successBody'), [
          { text: t('common.done'), onPress: () => router.replace('/(student)/(tabs)/bookings') },
        ]);
      } catch (err) {
        alert(t('common.error'), err instanceof Error ? err.message : '');
      } finally {
        setLoading(false);
      }
    };
    if (method === 'visa' || method === 'pay_now') {
      alert(t('booking.payNow'), t('booking.confirmVisa'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => void place() },
      ]);
      return;
    }
    void place();
  };

  if (!apartment) {
    return (
      <Screen back>
        {missing ? (
          <Card>
            <SectionHead icon="home-outline" title={t('listing.notFound')} />
            <Text style={[styles.muted, rtlText, { color: colors.textMuted }]}>{t('booking.empty')}</Text>
            <Button title={t('booking.findPlace')} onPress={() => router.replace('/(student)/(tabs)/search')} pill />
          </Card>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  const listingHero = (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.photoFallback, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="home" size={32} color={colors.primary} />
        </View>
      )}
      <View style={[styles.pricePill, isRtl ? styles.pillStart : styles.pillEnd, { backgroundColor: colors.primary }]}>
        <Text style={[styles.pricePillText, { color: colors.white }]}>
          {formatIls(apartment.price_month, lang)} / {t('common.perMonth')}
        </Text>
      </View>
      <View style={styles.heroBody}>
        <Text style={[styles.heroTitle, rtlText, { color: colors.text }]} numberOfLines={2}>
          {localizedTitle(apartment, i18n.language)}
        </Text>
        {city ? (
          <Text style={[styles.heroCity, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
            {city}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen
      back
      footer={
        canSubmit ? (
          <Button title={t('booking.submit')} onPress={() => void submit()} loading={loading} pill />
        ) : null
      }
    >
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.bookings')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('booking.title')}</Text>
      {listingHero}

      {!ready ? (
        <Card>
          <SectionHead icon="person-outline" title={t('booking.needProfile')} />
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.completeToBook')}</Text>
          <Button title={t('profile.title')} onPress={goProfile} pill />
        </Card>
      ) : null}

      {mismatch ? (
        <Card>
          <SectionHead icon="warning-outline" title={t('listing.genderMismatch')} />
          <Button
            title={t('booking.findPlace')}
            variant="secondary"
            onPress={() => router.replace('/(student)/(tabs)/search')}
            pill
          />
        </Card>
      ) : null}

      {canSubmit ? (
        <>
          <Card>
            <DateField label={t('booking.startDate')} value={startDate} onChange={setStartDate} kind="booking" />
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('booking.occupants')}</Text>
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('booking.occupantsHint')}</Text>
            <FilterPills
              value={String(headcount)}
              onChange={(next) => setOccupants(Number(next))}
              items={people.map((value) => ({
                value: String(value),
                label: value === 1 ? t('booking.onePerson') : t('booking.people', { count: value }),
              }))}
            />
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('booking.duration')}</Text>
            <FilterPills
              value={String(months)}
              onChange={(next) => setMonths(Number(next))}
              items={MONTHS.map((value) => ({
                value: String(value),
                label: `${value} ${value === 1 ? t('common.month') : t('common.months')}`,
              }))}
            />
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('booking.method')}</Text>
            <FilterPills
              value={method}
              onChange={setMethod}
              items={PAYMENT_CHOICES.map((value) => ({
                value,
                label: t(paymentI18nKey(value)),
              }))}
            />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t(paymentHintKey(method))}</Text>
            <Text style={[styles.note, rtlText, { color: colors.warning }]}>{t('payment.simulated')}</Text>
          </Card>

          <Card>
            <SectionHead icon="receipt-outline" title={t('booking.summary')} />
            <SummaryRow
              label={t('booking.rent')}
              value={`${formatIls(apartment.price_month, lang)} × ${months}`}
            />
            <SummaryRow
              label={t('booking.occupants')}
              value={headcount === 1 ? t('booking.onePerson') : t('booking.people', { count: headcount })}
            />
            <SummaryRow label={t('booking.commission')} value={`${formatIls(commission, lang)} (${percent}% × ${headcount})`} />
            <View style={[styles.totalBar, { backgroundColor: colors.primarySoft }, row]}>
              <Text style={[styles.totalLabel, rtlText, { color: colors.primary }]}>{t('booking.total')}</Text>
              <Text style={[styles.totalValue, { color: colors.primary }]}>{formatIls(total, lang)}</Text>
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginBottom: -8 },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  muted: { fontSize: 15, fontFamily: 'Cairo_400Regular' },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  photo: { width: '100%', height: 168 },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  pricePill: {
    position: 'absolute',
    top: 12,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pricePillText: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
  pillStart: { left: 12 },
  pillEnd: { right: 12 },
  heroBody: { padding: spacing.md, gap: 4 },
  heroTitle: { fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', lineHeight: 26 },
  heroCity: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  label: { fontWeight: '800', fontFamily: 'Cairo_700Bold' },
  note: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20, marginTop: -4 },
  summaryRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular' },
  summaryValue: { fontSize: 14, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  totalBar: {
    marginTop: 4,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: { flex: 1, fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  totalValue: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
});
