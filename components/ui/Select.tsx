import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

type Option = { label: string; value: string };

type Props = {
  label: string;
  value?: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
};

export function Select({ label, value, placeholder, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { textAlign } = useLayout();
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { textAlign }]}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.value, { textAlign }, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={[styles.empty, { textAlign }]}>{t('common.noResults')}</Text>
              ) : null}
              {options.map((option) => (
                <Pressable
                  key={option.value || 'empty'}
                  style={styles.option}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}>
                  <Text style={[styles.optionLabel, { textAlign }]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  value: { fontSize: 16, color: colors.text },
  placeholder: { color: colors.textMuted },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: { fontSize: 16, color: colors.text },
  empty: { padding: spacing.lg, color: colors.textMuted },
});
