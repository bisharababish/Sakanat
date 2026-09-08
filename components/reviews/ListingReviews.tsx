import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { StarRow } from '@/components/reviews/StarRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoteModal } from '@/components/ui/NoteModal';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { logAdminAction } from '@/src/lib/audit';
import { alert } from '@/src/lib/notice';
import { submitAppReport } from '@/src/lib/reports';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { ApartmentReview } from '@/src/types/database';

export function ListingReviews({
  reviews,
  average,
  count,
  asAdmin = false,
  ownerApartmentIds,
  onChanged,
}: {
  reviews: ApartmentReview[];
  average?: number | null;
  count?: number | null;
  asAdmin?: boolean;
  /** When set, owner can reply to reviews on these listings. */
  ownerApartmentIds?: string[];
  onChanged?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [reporting, setReporting] = useState<ApartmentReview | null>(null);
  const [replying, setReplying] = useState<ApartmentReview | null>(null);
  const [reportBody, setReportBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);
  const total = count ?? reviews.length;
  const avg = average ?? (reviews.length ? reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length : 0);
  const ownerSet = new Set(ownerApartmentIds ?? []);

  const remove = (item: ApartmentReview) => {
    alert(t('admin.deleteReview'), t('admin.confirmDeleteReview'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.deleteReview'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartment_reviews').delete().eq('id', item.id);
          if (error) {
            alert(t('common.error'), error.message);
            return;
          }
          void logAdminAction('review.delete', { targetId: item.id, targetUserId: item.student_id });
          onChanged?.();
        },
      },
    ]);
  };

  const sendReport = async () => {
    if (!profile || !reporting) return;
    if (reportBody.trim().length < 8) {
      alert(t('common.error'), t('review.reportShort'));
      return;
    }
    setBusy(true);
    try {
      await submitAppReport(profile.id, {
        kind: 'safety',
        subject: t('review.reportSubject'),
        body: `${reportBody.trim()}\n\nReview: ${reporting.note}`,
        targetApartmentId: reporting.apartment_id,
        targetUserId: reporting.student_id,
      });
      setReporting(null);
      setReportBody('');
      alert(t('common.done'), t('review.reportSent'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('review.reportFailed'));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!replying) return;
    if (replyBody.trim().length < 2) {
      alert(t('common.error'), t('review.replyShort'));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('owner_reply_review', {
        p_review_id: replying.id,
        p_reply: replyBody.trim(),
      });
      if (error) throw error;
      setReplying(null);
      setReplyBody('');
      alert(t('common.done'), t('review.replySent'));
      onChanged?.();
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('review.replyFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card compact={asAdmin}>
      <SectionHead compact={asAdmin} icon="star-outline" title={t('review.title')} />
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
      {reviews.map((item) => {
        const canReply =
          profile?.role === 'owner' && ownerSet.has(item.apartment_id) && !item.owner_reply;
        return (
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
            {item.owner_reply ? (
              <View style={[styles.replyBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.replyLabel, rtlText, { color: colors.primary }]}>
                  {t('review.ownerReply')}
                </Text>
                <Text style={[styles.note, rtlText, { color: colors.text }]}>{item.owner_reply}</Text>
              </View>
            ) : null}
            {asAdmin ? (
              <View style={[styles.actions, row]}>
                <Button title={t('admin.deleteReview')} variant="danger" pill onPress={() => remove(item)} />
              </View>
            ) : (
              <View style={[styles.actions, row]}>
                {canReply ? (
                  <Button
                    title={t('review.reply')}
                    variant="secondary"
                    pill
                    onPress={() => {
                      setReplyBody('');
                      setReplying(item);
                    }}
                  />
                ) : null}
                {profile && profile.id !== item.student_id ? (
                  <Button
                    title={t('review.report')}
                    variant="ghost"
                    pill
                    onPress={() => {
                      setReportBody('');
                      setReporting(item);
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>
        );
      })}
      <NoteModal
        visible={Boolean(reporting)}
        title={t('review.report')}
        label={t('review.reportDetails')}
        hint={t('review.reportHint')}
        value={reportBody}
        confirmTitle={t('review.report')}
        loading={busy}
        onChange={setReportBody}
        onConfirm={() => void sendReport()}
        onClose={() => setReporting(null)}
      />
      <NoteModal
        visible={Boolean(replying)}
        title={t('review.reply')}
        label={t('review.replyDetails')}
        hint={t('review.replyHint')}
        value={replyBody}
        confirmTitle={t('review.reply')}
        loading={busy}
        onChange={setReplyBody}
        onConfirm={() => void sendReply()}
        onClose={() => setReplying(null)}
      />
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
  actions: { marginTop: 4, flexWrap: 'wrap', gap: 8 },
  replyBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  replyLabel: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
});
