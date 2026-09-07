import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { StarRow } from '@/components/reviews/StarRow';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { logAdminAction } from '@/src/lib/audit';
import { localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { ApartmentReview } from '@/src/types/database';

type ReviewRow = ApartmentReview & {
  apartments?: { id: string; title_ar?: string; title_en?: string } | null;
};

export default function AdminReviews() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('apartment_reviews')
      .select('*, apartments(id, title_ar, title_en)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setReviews([]);
      return;
    }
    setReviews((data as ReviewRow[]) ?? []);
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['apartment_reviews'], 'admin-reviews');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reviews;
    return reviews.filter((item) => {
      const hay = [item.author_name, item.note, localizedTitle(item.apartments, i18n.language)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [reviews, query, i18n.language]);

  const remove = (item: ReviewRow) => {
    alert(t('admin.deleteReview'), t('admin.confirmDeleteReview'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.deleteReview'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          const { error } = await supabase.from('apartment_reviews').delete().eq('id', item.id);
          setBusyId(null);
          if (error) {
            alert(t('common.error'), error.message);
            return;
          }
          void logAdminAction('review.delete', { targetId: item.id, targetUserId: item.student_id });
          void load();
        },
      },
    ]);
  };

  return (
    <Screen back onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('roles.admin')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.reviewsTitle')}</Text>
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.reviewsHint')}</Text>
      <Input compact label={t('admin.searchReviews')} value={query} onChangeText={setQuery} />
      {visible.length === 0 ? <EmptyState title={t('admin.reviewsEmpty')} /> : null}
      {visible.map((item) => (
        <Card key={item.id} compact>
          <SectionHead compact icon="star-outline" title={item.author_name || t('chat.unknownPerson')} />
          <StarRow value={item.stars} size={14} />
          <Text style={[styles.note, rtlText, { color: colors.text }]}>{item.note}</Text>
          <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
            {localizedTitle(item.apartments, i18n.language) || '—'} ·{' '}
            {new Date(item.created_at).toLocaleDateString(i18n.language.startsWith('ar') ? 'ar' : 'en')}
          </Text>
          <View style={[styles.actions, row]}>
            {item.apartment_id ? (
              <Button
                title={t('admin.openListing')}
                variant="secondary"
                pill
                onPress={() =>
                  router.push({ pathname: '/(admin)/apartment/[id]', params: { id: item.apartment_id } })
                }
              />
            ) : null}
            {item.student_id ? (
              <Button
                title={t('admin.editUser')}
                variant="secondary"
                pill
                onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: item.student_id } })}
              />
            ) : null}
            <Button
              title={t('admin.deleteReview')}
              variant="danger"
              pill
              loading={busyId === item.id}
              onPress={() => remove(item)}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', marginBottom: spacing.xs },
  note: { fontSize: 14, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  meta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  actions: { flexWrap: 'wrap', gap: 8 },
});
