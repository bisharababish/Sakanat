import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { StarRow } from '@/components/reviews/StarRow';
import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { ApartmentReview } from '@/src/types/database';

export function ListingReviews({
  reviews,
  average,
  count,
}: {
  reviews: ApartmentReview[];
  average?: number | null;
  count?: number | null;
}) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const total = count ?? reviews.length;
  const avg = average ?? (reviews.length ? reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length : 0);

  return (
    <Card>
      <SectionHead icon="star-outline" title={t('review.title')} />
      {total > 0 ? (
        <View style={styles.summary}>
          <Text style={[styles.avg, rtlText, { color: colors.text }]}>{avg.toFixed(1)}</Text>
          <StarRow value={avg} />
          <Text style={[styles.count, rtlText, { color: colors.textMuted }]}>
            {t('review.count', { count: total })}
          </Text>
        </View>
      ) : (
        <Text style={[styles.empty, rtlText, { color: colors.textMuted }]}>{t('review.empty')}</Text>
      )}
      {reviews.map((item) => (
        <View key={item.id} style={[styles.item, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.head}>
            <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={1}>
              {item.author_name}
            </Text>
            <StarRow value={item.stars} size={14} />
          </View>
          <Text style={[styles.note, rtlText, { color: colors.text }]}>{item.note}</Text>
          <Text style={[styles.date, rtlText, { color: colors.textMuted }]}>
            {new Date(item.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'flex-start', gap: 6 },
  avg: { fontSize: 28, fontFamily: 'Cairo_800ExtraBold' },
  count: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  empty: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  item: { borderRadius: radius.md, padding: spacing.sm, gap: 6 },
  head: { gap: 4 },
  name: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  note: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  date: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
});
