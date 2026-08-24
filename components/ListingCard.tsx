import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import { formatKm } from '@/src/lib/distance';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { colors, radius } from '@/src/theme/colors';
import type { Apartment, University } from '@/src/types/database';

type Props = {
  apartment: Apartment;
  university?: University | null;
  distanceKm?: number | null;
  onPress: () => void;
};

export function ListingCard({ apartment, university, distanceKm, onPress }: Props) {
  const { t } = useTranslation();
  const { lang, row, rtlText } = useLayout();
  const photo = apartment.photos[0];
  const city = localizedName(apartment.cities, lang);

  return (
    <Card onPress={onPress}>
      {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" /> : <View style={styles.photoFallback} />}
      <Text style={[styles.title, rtlText]}>{localizedTitle(apartment, lang)}</Text>
      <View style={[styles.meta, row]}>
        <Text style={styles.price}>{formatIls(apartment.price_month, lang)}</Text>
        <Text style={styles.muted}> / {t('common.perMonth')}</Text>
      </View>
      <Text style={[styles.muted, rtlText]}>
        {city}
        {university ? ` · ${localizedName(university, lang)}` : ''}
      </Text>
      <Text style={[styles.muted, rtlText]}>
        {t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms })}
        {distanceKm != null ? ` · ${formatKm(distanceKm, lang)}` : ''}
      </Text>
      <Text style={[styles.muted, rtlText]}>{t(`gender.${apartment.gender_policy}`)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  photoFallback: { width: '100%', height: 120, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { alignItems: 'baseline' },
  price: { fontSize: 18, fontWeight: '800', color: colors.primary },
  muted: { color: colors.textMuted, fontSize: 13 },
});
