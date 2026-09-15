import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { StarRow } from '@/components/reviews/StarRow';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { REVIEW_NOTE_MAX, REVIEW_NOTE_MIN } from '@/src/lib/reviews';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function ReviewForm({
  visible,
  title,
  stars,
  note,
  error,
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
  error?: string;
  loading?: boolean;
  onStars: (next: number) => void;
  onNote: (next: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const safe = useModalSafeArea();

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const edgeBack = useEdgeBack(visible, close);

  const submit = () => {
    Keyboard.dismiss();
    onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        {...edgeBack}
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: Math.max(safe.top, spacing.md),
              marginBottom: Math.max(safe.bottom, spacing.md),
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.sheetBody}
          >
            <Text style={[styles.title, rtlText, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('review.formHint')}</Text>
            <StarRow value={stars} size={32} onChange={onStars} />
            <Input
              label={t('review.note')}
              value={note}
              onChangeText={onNote}
              placeholder={t('review.notePlaceholder')}
              multiline
              maxLength={REVIEW_NOTE_MAX}
              hint={t('review.noteHint', { min: REVIEW_NOTE_MIN })}
            />
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                <Text style={[styles.errorText, rtlText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.actions}>
              <Button title={t('common.cancel')} variant="ghost" pill onPress={close} />
              <Button title={t('review.submit')} pill loading={loading} onPress={submit} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: radius.xl,
    maxHeight: '86%',
    zIndex: 1,
    elevation: 8,
  },
  sheetBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  errorText: { fontSize: 14, lineHeight: 20, fontFamily: 'Cairo_600SemiBold' },
  actions: { gap: 8, marginTop: 4 },
});
