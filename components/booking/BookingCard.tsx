import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { bookingStatusLabel, bookingTone, formatBookingDate, formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Booking } from '@/src/types/database';

type Props = {
  booking: Booking;
  personIcon?: ComponentProps<typeof Ionicons>['name'];
  personLabel?: string;
  extra?: string;
  children?: ReactNode;
};

function MetaLine({
  icon,
  text,
  color,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  color: string;
}) {
  const { textAlign, writingDirection } = useLayout();
  const colors = useColors();
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={16} color={color} style={styles.metaIcon} />
      <Text style={[styles.meta, { textAlign, writingDirection, color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

export function BookingCard({ booking, personIcon = 'person', personLabel, extra, children }: Props) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, lang } = useLayout();
  const colors = useColors();
  const photo = booking.apartments?.photos?.[0];
  const city = localizedName(booking.apartments?.cities, i18n.language);
  const monthsLabel = `${booking.months} ${booking.months === 1 ? t('common.month') : t('common.months')}`;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
      <View style={styles.top}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoFallback, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="home" size={22} color={colors.primary} />
          </View>
        )}
        <View style={styles.head}>
          <Text style={[styles.title, { textAlign, writingDirection, color: colors.text }]} numberOfLines={2}>
            {localizedTitle(booking.apartments, i18n.language)}
          </Text>
          {city ? (
            <Text style={[styles.city, { textAlign, writingDirection, color: colors.textMuted }]} numberOfLines={1}>
              {city}
            </Text>
          ) : null}
          <StatusBadge label={bookingStatusLabel(booking.status, t)} tone={bookingTone(booking.status)} />
        </View>
      </View>

      {personLabel ? <MetaLine icon={personIcon} text={personLabel} color={colors.primary} /> : null}
      <MetaLine
        icon="people-outline"
        text={
          (booking.occupants ?? 1) === 1
            ? t('booking.onePerson')
            : t('booking.people', { count: booking.occupants ?? 1 })
        }
        color={colors.primary}
      />
      <MetaLine icon="cash-outline" text={formatIls(booking.rent_amount, lang)} color={colors.accent} />
      <MetaLine
        icon="card-outline"
        text={`${t(`payment.${booking.payment_method}`)} · ${t(`payment.${booking.payment_status}`)}`}
        color={colors.primary}
      />
      <MetaLine
        icon="calendar-outline"
        text={`${formatBookingDate(booking.start_date, i18n.language)} · ${monthsLabel}`}
        color={colors.primary}
      />
      {extra ? <MetaLine icon="pricetag-outline" text={extra} color={colors.accent} /> : null}

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  photoFallback: {},
  head: { flex: 1, minWidth: 0, gap: 6 },
  title: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    lineHeight: 24,
  },
  city: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaIcon: { width: 18, flexShrink: 0 },
  meta: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Cairo_400Regular',
  },
  actions: { gap: 8, marginTop: 4 },
});
