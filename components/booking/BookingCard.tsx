import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { paymentI18nKey } from '@/src/lib/booking';
import { bookingStatusLabel, bookingTone, formatBookingDate, formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Booking } from '@/src/types/database';

type Props = {
  booking: Booking;
  personIcon?: ComponentProps<typeof Ionicons>['name'];
  personLabel?: string;
  extra?: string;
  extraIcon?: ComponentProps<typeof Ionicons>['name'];
  warning?: string;
  note?: string;
  children?: ReactNode;
};

function Fact({
  icon,
  text,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.fact, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={[styles.factText, { color: colors.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export function BookingCard({
  booking,
  personIcon = 'person',
  personLabel,
  extra,
  extraIcon = 'pricetag-outline',
  warning,
  note,
  children,
}: Props) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, lang, row, isRtl } = useLayout();
  const colors = useColors();
  const photo = booking.apartments?.photos?.[0];
  const city = localizedName(booking.apartments?.cities, i18n.language);
  const monthsLabel = `${booking.months} ${booking.months === 1 ? t('common.month') : t('common.months')}`;
  const people = booking.occupants ?? 1;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
      <View style={styles.coverWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.coverFallback, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="home" size={32} color={colors.primary} />
          </View>
        )}
        <View style={[styles.badge, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
          <StatusBadge overlay label={bookingStatusLabel(booking.status, t)} tone={bookingTone(booking.status)} />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { textAlign, writingDirection, color: colors.text }]} numberOfLines={2}>
          {localizedTitle(booking.apartments, i18n.language)}
        </Text>
        {city ? (
          <Text style={[styles.city, { textAlign, writingDirection, color: colors.textMuted }]} numberOfLines={1}>
            {city}
          </Text>
        ) : null}

        <View style={[styles.payRow, row]}>
          <View>
            <Text style={[styles.payLabel, { color: colors.textMuted }]}>{t('booking.rent')}</Text>
            <Text style={[styles.payValue, { color: colors.primary }]}>{formatIls(booking.rent_amount, lang)}</Text>
          </View>
          <View style={[styles.payPill, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.payPillText, { color: colors.primaryDark }]}>
              {t(paymentI18nKey(booking.payment_method))} · {t(`payment.${booking.payment_status}`)}
            </Text>
          </View>
        </View>

        <View style={styles.facts}>
          {personLabel ? <Fact icon={personIcon} text={personLabel} /> : null}
          <Fact
            icon="people-outline"
            text={people === 1 ? t('booking.onePerson') : t('booking.people', { count: people })}
          />
          <Fact icon="calendar-outline" text={`${formatBookingDate(booking.start_date, i18n.language)} · ${monthsLabel}`} />
          {extra ? <Fact icon={extraIcon} text={extra} /> : null}
        </View>

        {warning ? (
          <View style={[styles.warn, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={[styles.warnText, { color: colors.warning, textAlign, writingDirection }]}>{warning}</Text>
          </View>
        ) : null}
        {note ? (
          <Text style={[styles.note, { color: colors.textMuted, textAlign, writingDirection }]}>{note}</Text>
        ) : null}

        {children ? <View style={styles.actions}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: 148 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'flex-start' },
  body: { padding: spacing.md, gap: 10 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    lineHeight: 26,
  },
  city: { fontSize: 13, fontFamily: 'Cairo_400Regular', marginTop: -6 },
  payRow: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  payLabel: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  payValue: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  payPill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '52%' },
  payPillText: { fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  factText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', flexShrink: 1 },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warnText: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Cairo_700Bold' },
  note: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  actions: { gap: 8, marginTop: 4 },
});
