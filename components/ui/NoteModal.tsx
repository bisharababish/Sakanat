import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function NoteModal({
  visible,
  title,
  label,
  hint,
  value,
  confirmTitle,
  loading,
  onChange,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  label: string;
  hint?: string;
  value: string;
  confirmTitle: string;
  loading?: boolean;
  onChange: (next: string) => void;
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
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{title}</Text>
          <Input label={label} value={value} onChangeText={onChange} hint={hint} multiline />
          <Button title={confirmTitle} variant="danger" pill loading={loading} onPress={onConfirm} />
          <Button title={t('common.cancel')} variant="ghost" pill onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    zIndex: 1,
  },
  title: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
});
