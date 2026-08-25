import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/ui/BackButton';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

type Option = { label: string; value: string };

type Props = {
  label: string;
  value?: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
  soft?: boolean;
};

export function Select({ label, value, placeholder, options, onChange, soft }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { rtlText, alignStart } = useLayout();
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, rtlText]}>{label}</Text>
      <Pressable style={[styles.field, soft ? styles.soft : null]} onPress={() => setOpen(true)}>
        <Text style={[styles.value, rtlText, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={[styles.sheetHead, { alignItems: alignStart }]}>
              <BackButton onPress={() => setOpen(false)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={[styles.empty, rtlText]}>{t('common.noResults')}</Text>
              ) : null}
              {options.map((option) => (
                <Pressable
                  key={option.value || 'empty'}
                  style={styles.option}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}>
                  <Text style={[styles.optionLabel, rtlText]}>{option.label}</Text>
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
  soft: {
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
    borderRadius: radius.full,
    minHeight: 54,
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
  sheetHead: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: { fontSize: 16, color: colors.text },
  empty: { padding: spacing.lg, color: colors.textMuted },
});
