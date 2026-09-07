import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  presets,
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
  presets?: string[];
  onChange: (next: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{title}</Text>
          {presets && presets.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.presets, row]}>
              {presets.map((item) => {
                const on = value === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => onChange(item)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colors.dangerSoft : colors.surfaceMuted,
                        borderColor: on ? colors.danger : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: on ? colors.danger : colors.text }]} numberOfLines={1}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
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
    maxHeight: '90%',
  },
  title: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  presets: { gap: 8, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 220,
  },
  chipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
});
