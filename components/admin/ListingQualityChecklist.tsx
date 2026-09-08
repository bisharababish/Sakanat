import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import {
  LISTING_MIN_PHOTOS,
  listingQualityIssues,
  type ListingQualityIssue,
} from '@/src/lib/listingQuality';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment } from '@/src/types/database';

function issueLabel(issue: ListingQualityIssue, t: (key: string, vars?: Record<string, unknown>) => string) {
  if (issue === 'photos') return t('owner.qualityPhotos', { count: LISTING_MIN_PHOTOS });
  if (issue === 'description') return t('owner.qualityDescription');
  if (issue === 'amenities') return t('owner.qualityAmenities');
  if (issue === 'campus') return t('owner.qualityCampus');
  if (issue === 'title') return t('admin.qualityTitle');
  if (issue === 'city') return t('admin.qualityCity');
  return t('admin.qualityPrice');
}

export function ListingQualityChecklist({ apartment }: { apartment: Apartment }) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const issues = listingQualityIssues({
    titleAr: apartment.title_ar,
    titleEn: apartment.title_en,
    descriptionAr: apartment.description_ar,
    descriptionEn: apartment.description_en,
    cityId: apartment.city_id,
    price: apartment.price_month,
    photos: apartment.photos ?? [],
    amenities: apartment.amenities ?? [],
    universityId: apartment.nearest_university_id,
    campusKm: apartment.campus_distance_km,
  });
  const checks: { key: ListingQualityIssue | 'ok'; ok: boolean; label: string }[] = [
    {
      key: 'photos',
      ok: !issues.includes('photos'),
      label: t('admin.checkPhotos', { count: LISTING_MIN_PHOTOS, have: apartment.photos?.length ?? 0 }),
    },
    {
      key: 'description',
      ok: !issues.includes('description'),
      label: t('admin.checkDescription'),
    },
    {
      key: 'amenities',
      ok: !issues.includes('amenities'),
      label: t('admin.checkAmenities', { count: apartment.amenities?.length ?? 0 }),
    },
    {
      key: 'campus',
      ok: !issues.includes('campus'),
      label: t('admin.checkCampus'),
    },
    {
      key: 'title',
      ok: !issues.includes('title') && !issues.includes('city') && !issues.includes('price'),
      label: t('admin.checkBasics'),
    },
  ];

  return (
    <Card>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.qualityChecklist')}</Text>
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
        {issues.length === 0 ? t('admin.qualityPass') : t('admin.qualityFail', { count: issues.length })}
      </Text>
      {checks.map((item) => (
        <View key={item.key} style={[styles.row, row]}>
          <Ionicons
            name={item.ok ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={item.ok ? colors.success : colors.warning}
          />
          <Text style={[styles.label, rtlText, { color: item.ok ? colors.text : colors.warning }]}>{item.label}</Text>
        </View>
      ))}
      {issues.length > 0 ? (
        <View style={[styles.box, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
          {issues.map((issue) => (
            <Text key={issue} style={[styles.issue, rtlText, { color: colors.text }]}>
              • {issueLabel(issue, t)}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function apartmentHasQualityIssues(apartment: Apartment) {
  return (
    listingQualityIssues({
      titleAr: apartment.title_ar,
      titleEn: apartment.title_en,
      descriptionAr: apartment.description_ar,
      descriptionEn: apartment.description_en,
      cityId: apartment.city_id,
      price: apartment.price_month,
      photos: apartment.photos ?? [],
      amenities: apartment.amenities ?? [],
      universityId: apartment.nearest_university_id,
      campusKm: apartment.campus_distance_km,
    }).length > 0
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular', marginBottom: 4 },
  row: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  label: { flex: 1, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: 4, marginTop: 6 },
  issue: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
});
