import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StarRow } from '@/components/reviews/StarRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { formatKm, type DistancePlace } from '@/src/lib/distance';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, University } from '@/src/types/database';

type Props = {
  apartment: Apartment;
  university?: University | null;
  distanceKm?: number | null;
  distancePlace?: DistancePlace;
  saved?: boolean;
  onToggleSave?: () => void;
  badge?: { label: string; tone: 'pending' | 'approved' | 'rejected' | 'info' };
  onPress: () => void;
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
      <Ionicons name={icon} size={13} color={colors.primary} />
      <Text style={[styles.factText, { color: colors.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export function ListingCard({
  apartment,
  university,
  distanceKm,
  distancePlace = 'campus',
  saved,
  onToggleSave,
  badge,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const { lang, textAlign, writingDirection, isRtl } = useLayout();
  const colors = useColors();
  const photo = apartment.photos[0];
  const city = localizedName(apartment.cities, lang);
  const copy = { textAlign, writingDirection };
  const photoCount = apartment.photos?.filter(Boolean).length ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.coverWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoFallback, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="home" size={32} color={colors.primary} />
          </View>
        )}
        <View style={styles.wash} />
        <View style={[styles.pricePill, isRtl ? styles.pillStart : styles.pillEnd, { backgroundColor: colors.primary }]}>
          <Text style={[styles.pricePillText, { color: colors.white }]}>
            {formatIls(apartment.price_month, lang)} / {t('common.perMonth')}
          </Text>
        </View>
        {photoCount > 1 ? (
          <View style={[styles.countPill, isRtl ? styles.pillEnd : styles.pillStart, { backgroundColor: 'rgba(28, 36, 30, 0.72)' }]}>
            <Ionicons name="images-outline" size={12} color={colors.white} />
            <Text style={[styles.countText, { color: colors.white }]}>{photoCount}</Text>
          </View>
        ) : null}
        {badge ? (
          <View style={[styles.badgeWrap, isRtl ? styles.heartEnd : styles.heartStart]}>
            <StatusBadge label={badge.label} tone={badge.tone} overlay />
          </View>
        ) : null}
        {onToggleSave ? (
          <Pressable
            onPress={onToggleSave}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={saved ? t('listing.saved') : t('listing.save')}
            style={[styles.heart, isRtl ? styles.heartStart : styles.heartEnd, { backgroundColor: colors.white }]}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? colors.danger : colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, copy, { color: colors.text }]} numberOfLines={2}>
          {localizedTitle(apartment, lang)}
        </Text>
        {city || university ? (
          <View style={[styles.cityRow, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={[styles.muted, copy, { color: colors.textMuted }]} numberOfLines={1}>
              {[city, university ? localizedName(university, lang) : ''].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
        <View style={[styles.facts, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
          <Fact icon="bed-outline" text={String(apartment.rooms)} />
          <Fact icon="water-outline" text={String(apartment.bathrooms)} />
          <Fact icon="people-outline" text={t(`gender.${apartment.gender_policy}`)} />
          {distanceKm != null ? <Fact icon="navigate-outline" text={formatKm(distanceKm, lang, distancePlace)} /> : null}
          {(apartment.review_count ?? 0) > 0 ? (
            <View style={[styles.fact, { backgroundColor: colors.surfaceMuted }]}>
              <StarRow value={apartment.review_avg ?? 0} size={13} />
              <Text style={[styles.factText, { color: colors.text }]}>
                {(apartment.review_avg ?? 0).toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
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
  pressed: { opacity: 0.94 },
  coverWrap: { position: 'relative' },
  photo: { width: '100%', height: 176 },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  wash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    backgroundColor: 'rgba(18, 22, 20, 0.22)',
  },
  badgeWrap: { position: 'absolute', top: 12, zIndex: 2 },
  pricePill: {
    position: 'absolute',
    bottom: 12,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countPill: {
    position: 'absolute',
    bottom: 12,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: { fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  pillStart: { start: 12 },
  pillEnd: { end: 12 },
  pricePillText: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
  heart: {
    position: 'absolute',
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heartStart: { start: 12 },
  heartEnd: { end: 12 },
  body: { padding: spacing.md, gap: 8 },
  title: { fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', lineHeight: 26 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2 },
  muted: { flex: 1, fontSize: 13, fontFamily: 'Cairo_400Regular' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  factText: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
});
