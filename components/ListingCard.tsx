import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { formatKm, type DistancePlace } from '@/src/lib/distance';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { listingPlaceLine } from '@/src/lib/listingPlace';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, University } from '@/src/types/database';

type Props = {
  apartment: Apartment;
  university?: University | null;
  distanceKm?: number | null;
  distancePlace?: DistancePlace;
  saved?: boolean;
  onToggleSave?: () => void;
  ownerVerified?: boolean;
  badge?: { label: string; tone: 'pending' | 'approved' | 'rejected' | 'info' };
  onPress: () => void;
};

export function ListingCard({
  apartment,
  university,
  distanceKm,
  distancePlace = 'campus',
  saved,
  onToggleSave,
  ownerVerified,
  badge,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const { lang, textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const photo = apartment.photos[0];
  const city = localizedName(apartment.cities, lang);
  const copy = { textAlign, writingDirection };
  const photoCount = apartment.photos?.filter(Boolean).length ?? 0;
  const place = listingPlaceLine(apartment, t);
  const meta = [
    place,
    t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms }),
    apartment.area_m2 ? t('listing.area', { area: apartment.area_m2 }) : '',
    t(`gender.${apartment.gender_policy}`),
    distanceKm != null
      ? formatKm(distanceKm, lang, distancePlace)
      : university
        ? localizedName(university, lang)
        : city,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={localizedTitle(apartment, lang)}
      style={({ pressed }) => [
        styles.card,
        row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.thumbWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="home" size={24} color={colors.primary} />
          </View>
        )}
        {photoCount > 1 ? (
          <View style={[styles.countPill, { backgroundColor: 'rgba(28, 36, 30, 0.72)' }]}>
            <Text style={[styles.countText, { color: colors.white }]}>{photoCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={[styles.titleRow, row]}>
          <Text style={[styles.title, copy, { color: colors.text }]} numberOfLines={1}>
            {localizedTitle(apartment, lang)}
          </Text>
          {ownerVerified ? <Ionicons name="shield-checkmark" size={14} color={colors.primary} /> : null}
          {onToggleSave ? (
            <Pressable
              onPress={onToggleSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={saved ? t('listing.saved') : t('listing.save')}
            >
              <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? colors.danger : colors.primary} />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.priceChip, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.priceText, { color: colors.primaryDark }]}>{formatIls(apartment.price_month, lang)}</Text>
        </View>
        <Text style={[styles.meta, copy, { color: colors.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
        {badge ? (
          <View style={styles.badge}>
            <StatusBadge label={badge.label} tone={badge.tone} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 8,
  },
  pressed: { opacity: 0.94 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 108, height: 108, borderRadius: 16 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  countPill: {
    position: 'absolute',
    end: 6,
    bottom: 6,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
  body: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 6 },
  titleRow: { alignItems: 'center', gap: 6 },
  title: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: 'Cairo_700Bold' },
  priceChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  priceText: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  meta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  badge: { alignSelf: 'flex-start' },
});
