import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { paymentI18nKey } from '@/src/lib/booking';
import { bookingStatusLabel, bookingTone, formatBookingDate, formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Booking } from '@/src/types/database';

type Props = {
  booking: Booking;
  personIcon?: ComponentProps<typeof Ionicons>['name'];
  personLabel?: string;
  personAvatar?: string | null;
  extra?: string;
  extraIcon?: ComponentProps<typeof Ionicons>['name'];
  details?: string[];
  warning?: string;
  note?: string;
  nextAction?: string;
  nextIcon?: ComponentProps<typeof Ionicons>['name'];
  highlighted?: boolean;
  kicker?: string;
  noteLines?: number;
  onViewListingPhoto?: () => void;
  onViewPersonPhoto?: () => void;
  children?: ReactNode;
};

export function BookingCard({
  booking,
  personIcon = 'person',
  personLabel,
  personAvatar,
  extra,
  details = [],
  warning,
  note,
  nextAction,
  nextIcon = 'flag-outline',
  highlighted,
  kicker,
  noteLines = 2,
  onViewListingPhoto,
  onViewPersonPhoto,
  children,
}: Props) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, lang, row } = useLayout();
  const colors = useColors();
  const photo = booking.apartments?.photos?.[0];
  const city = localizedName(booking.apartments?.cities, i18n.language);
  const monthsLabel = `${booking.months} ${booking.months === 1 ? t('common.month') : t('common.months')}`;
  const people = booking.occupants ?? 1;
  const copy = { textAlign, writingDirection };
  const facts = [
    people === 1 ? t('booking.onePerson') : t('booking.people', { count: people }),
    `${formatBookingDate(booking.start_date, i18n.language)} · ${monthsLabel}`,
    extra,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: highlighted ? colors.primary : colors.border,
          borderWidth: highlighted ? 2 : 1,
        },
      ]}
    >
      {kicker ? (
        <Text style={[styles.kicker, copy, { color: colors.primary }]} numberOfLines={1}>
          {kicker}
        </Text>
      ) : null}
      <View style={[styles.head, row]}>
        {photo ? (
          <Pressable
            onPress={onViewListingPhoto}
            disabled={!onViewListingPhoto}
            accessibilityRole={onViewListingPhoto ? 'button' : undefined}
            accessibilityLabel={onViewListingPhoto ? t('profile.viewPhoto') : undefined}
          >
            <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
          </Pressable>
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="home" size={20} color={colors.primary} />
          </View>
        )}
        <View style={styles.headCopy}>
          <View style={[styles.titleRow, row]}>
            <Text style={[styles.title, copy, { color: colors.text }]} numberOfLines={1}>
              {localizedTitle(booking.apartments, i18n.language)}
            </Text>
            <StatusBadge label={bookingStatusLabel(booking.status, t)} tone={bookingTone(booking.status)} compact />
          </View>
          <Text style={[styles.price, copy, { color: colors.primary }]} numberOfLines={1}>
            {formatIls(booking.rent_amount, lang)}
            {city ? ` · ${city}` : ''}
          </Text>
          <Text style={[styles.meta, copy, { color: colors.textMuted }]} numberOfLines={1}>
            {facts}
          </Text>
        </View>
      </View>

      {nextAction ? (
        <View style={[styles.next, row, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={nextIcon} size={14} color={colors.primary} />
          <Text style={[styles.nextText, copy, { color: colors.primaryDark }]} numberOfLines={1}>
            {nextAction}
          </Text>
        </View>
      ) : null}

      <View style={[styles.metaRow, row]}>
        <Text style={[styles.pay, copy, { color: colors.textMuted }]} numberOfLines={1}>
          {t(paymentI18nKey(booking.payment_method))}
        </Text>
        <StatusBadge
          compact
          label={t(`payment.${booking.payment_status}`)}
          tone={booking.payment_status === 'paid' ? 'approved' : booking.status === 'cancelled' ? 'info' : 'pending'}
        />
        {personLabel ? (
          <View style={[styles.person, row]}>
            {personAvatar ? (
              <Pressable
                onPress={onViewPersonPhoto}
                disabled={!onViewPersonPhoto}
                accessibilityRole={onViewPersonPhoto ? 'button' : undefined}
                accessibilityLabel={onViewPersonPhoto ? t('profile.viewPhoto') : undefined}
              >
                <Image source={{ uri: personAvatar }} style={styles.personAvatar} />
              </Pressable>
            ) : (
              <Ionicons name={personIcon} size={12} color={colors.primary} />
            )}
            <Text style={[styles.personName, copy, { color: colors.text }]} numberOfLines={1}>
              {personLabel}
            </Text>
          </View>
        ) : null}
      </View>
      {details.map((item) => (
        <Text key={item} style={[styles.meta, copy, { color: colors.textMuted }]} numberOfLines={1}>
          {item}
        </Text>
      ))}

      {warning ? (
        <Text style={[styles.warn, copy, { color: colors.warning }]} numberOfLines={2}>
          {warning}
        </Text>
      ) : null}
      {note ? (
        <Text style={[styles.note, copy, { color: colors.textMuted }]} numberOfLines={noteLines}>
          {note}
        </Text>
      ) : null}

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  kicker: { fontSize: 10, fontFamily: 'Cairo_800ExtraBold' },
  head: { alignItems: 'center', gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  headCopy: { flex: 1, minWidth: 0, gap: 1 },
  titleRow: { alignItems: 'center', gap: 6 },
  title: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Cairo_800ExtraBold' },
  price: { fontSize: 12, fontFamily: 'Cairo_800ExtraBold' },
  meta: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  next: {
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  nextText: { flex: 1, minWidth: 0, fontSize: 11, fontFamily: 'Cairo_700Bold' },
  metaRow: { alignItems: 'center', gap: 8 },
  pay: { fontSize: 10, fontFamily: 'Cairo_700Bold', flexShrink: 0 },
  person: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  personAvatar: { width: 16, height: 16, borderRadius: 8 },
  personName: { flex: 1, minWidth: 0, fontSize: 11, fontFamily: 'Cairo_700Bold' },
  warn: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  note: { fontSize: 11, fontFamily: 'Cairo_400Regular', lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 1 },
});
