import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { formatKm } from '@/src/lib/distance';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, University } from '@/src/types/database';

type Props = {
  apartment: Apartment;
  university?: University | null;
  distanceKm?: number | null;
  saved?: boolean;
  onToggleSave?: () => void;
  badge?: { label: string; tone: 'pending' | 'approved' | 'rejected' | 'info' };
  onPress: () => void;
};

export function ListingCard({
  apartment,
  university,
  distanceKm,
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

  return (
    <Card onPress={onPress}>
      <View>
        {photo ? (
          <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
        ) : (
          <View style={[styles.photoFallback, { backgroundColor: colors.primarySoft }]} />
        )}
        <View style={[styles.pricePill, isRtl ? styles.pillStart : styles.pillEnd, { backgroundColor: colors.primary }]}>
          <Text style={[styles.pricePillText, { color: colors.white }]}>
            {formatIls(apartment.price_month, lang)} / {t('common.perMonth')}
          </Text>
        </View>
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
            style={[styles.heart, isRtl ? styles.heartEnd : styles.heartStart, { backgroundColor: colors.white }]}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? colors.danger : colors.primary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.title, copy, { color: colors.text }]} numberOfLines={2}>
        {localizedTitle(apartment, lang)}
      </Text>
      <Text style={[styles.muted, copy, { color: colors.textMuted }]} numberOfLines={1}>
        {[city, university ? localizedName(university, lang) : '']
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <View style={[styles.chips, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.chipText, { color: colors.primaryDark }]}>{t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms })}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.chipText, { color: colors.primaryDark }]}>{t(`gender.${apartment.gender_policy}`)}</Text>
        </View>
        {distanceKm != null ? (
          <View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.chipText, { color: colors.primaryDark }]}>{formatKm(distanceKm, lang)}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 168, borderRadius: radius.lg },
  photoFallback: { width: '100%', height: 168, borderRadius: radius.lg },
  badgeWrap: { position: 'absolute', top: 10, zIndex: 2 },
  pricePill: {
    position: 'absolute',
    bottom: 10,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillStart: { start: 10 },
  pillEnd: { end: 10 },
  pricePillText: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
  heart: {
    position: 'absolute',
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartStart: { start: 10 },
  heartEnd: { end: 10 },
  title: { fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  muted: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
});
