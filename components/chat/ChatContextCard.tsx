import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { majorLabel } from '@/src/data/majors';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useToday } from '@/src/hooks/useToday';
import { ageLabel, formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { listingPlaceLine } from '@/src/lib/listingPlace';
import { displayName } from '@/src/lib/name';
import { seekerRoleLabel } from '@/src/lib/seeker';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

export function ChatContextCard({
  conversation,
  asOwner,
  showListing = true,
  onOpenListing,
}: {
  conversation: Conversation | null;
  asOwner?: boolean;
  showListing?: boolean;
  onOpenListing?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { universities, cities } = useCatalog();
  const today = useToday();
  const listing = showListing ? conversation?.apartments : null;
  const student = conversation?.student;
  if (!listing && !(asOwner && student)) return null;

  const lang = i18n.language;
  const title = localizedTitle(listing, lang);
  const place = listingPlaceLine(listing, t);
  const city = listing
    ? localizedName(
        cities.find((item) => item.id === listing.city_id),
        lang,
      )
    : '';
  const price = listing?.price_month ? `${formatIls(listing.price_month, lang)} / ${t('common.perMonth')}` : '';
  const listingLine = [title, [place, city].filter(Boolean).join(' · '), price].filter(Boolean).join(' · ');
  const photo = listing?.photos?.[0];
  const uni = student?.university_id
    ? localizedName(
        universities.find((item) => item.id === student.university_id),
        lang,
      )
    : '';
  const about = student
    ? [
        displayName(student, lang) || student.full_name,
        seekerRoleLabel(student.role, t),
        student.gender === 'male' || student.gender === 'female' ? t(`profile.${student.gender}`) : '',
        ageLabel(student.date_of_birth, t, today),
        uni,
        student.major ? majorLabel(student.major, lang) : '',
        student.study_year ? t(`profile.year${student.study_year}`) : '',
      ]
        .filter((item) => item && !String(item).startsWith('profile.year'))
        .join(' · ')
    : '';

  return (
    <Pressable
      onPress={onOpenListing}
      disabled={!onOpenListing}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
      ) : null}
      <View style={styles.copy}>
        {listingLine ? (
          <Text style={[styles.listing, rtlText, { color: colors.primary }]} numberOfLines={2}>
            {listingLine}
          </Text>
        ) : null}
        {asOwner && about ? (
          <Text style={[styles.about, rtlText, { color: colors.textMuted }]} numberOfLines={2}>
            {about}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  photo: { width: 44, height: 44, borderRadius: 12 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  listing: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  about: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
});
