import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StarRow } from '@/components/reviews/StarRow';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { REVIEW_NOTE_MAX, REVIEW_NOTE_MIN } from '@/src/lib/reviews';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function ReviewForm({
  visible,
  title,
  stars,
  note,
  loading,
  onStars,
  onNote,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  stars: number;
  note: string;
  loading?: boolean;
  onStars: (next: number) => void;
  onNote: (next: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('review.formHint')}</Text>
          <StarRow value={stars} size={32} onChange={onStars} />
          <Input
            label={t('review.note')}
            value={note}
            onChangeText={onNote}
            multiline
            maxLength={REVIEW_NOTE_MAX}
            hint={t('review.noteHint', { min: REVIEW_NOTE_MIN })}
          />
          <View style={styles.actions}>
            <Button title={t('common.cancel')} variant="ghost" pill onPress={onClose} />
            <Button title={t('review.submit')} pill loading={loading} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  actions: { gap: 8, marginTop: 4 },
});
