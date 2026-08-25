import { type ComponentProps, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/ui/BackButton';
import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Option = { label: string; value: string };

type Props = {
  label: string;
  value?: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
  soft?: boolean;
  compact?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function Select({ label, value, placeholder, options, onChange, soft, compact, icon }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { rtlText, alignStart, isRtl, textAlign, writingDirection } = useLayout();
  const colors = useColors();
  const selected = options.find((option) => option.value === value);
  const active = Boolean(value);

  return (
    <View style={styles.wrap}>
      {compact ? null : <Text style={[styles.label, rtlText, { color: colors.text }]}>{label}</Text>}
      <Pressable
        accessibilityLabel={label}
        style={[
          compact ? styles.compact : styles.field,
          {
            backgroundColor: compact && active ? colors.primarySoft : soft && !compact ? colors.surfaceMuted : colors.surface,
            borderColor: compact && active ? colors.primary : soft && !compact ? 'transparent' : colors.border,
          },
          compact ? { flexDirection: isRtl ? 'row-reverse' : 'row' } : null,
        ]}
        onPress={() => setOpen(true)}
      >
        {compact && icon ? (
          <Ionicons name={icon} size={16} color={active ? colors.primary : colors.textMuted} />
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            compact ? styles.compactValue : styles.value,
            { color: !selected ? colors.textMuted : compact && active ? colors.primary : colors.text, textAlign, writingDirection },
          ]}
        >
          {selected?.label ?? placeholder}
        </Text>
        {compact ? (
          <Ionicons name="chevron-down" size={14} color={active ? colors.primary : colors.textMuted} />
        ) : null}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHead, { alignItems: alignStart }]}>
              <BackButton onPress={() => setOpen(false)} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={[styles.empty, rtlText, { color: colors.textMuted }]}>{t('common.noResults')}</Text>
              ) : null}
              {options.map((option) => (
                <Pressable
                  key={option.value || 'empty'}
                  style={[styles.option, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}>
                  <Text style={[styles.optionLabel, rtlText, { color: colors.text }]}>{option.label}</Text>
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
  label: { fontWeight: '700', fontSize: 14 },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  compact: {
    borderWidth: 1,
    borderRadius: radius.full,
    minHeight: 44,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  compactValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
  },
  value: { fontSize: 16 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    maxHeight: '70%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sheetHead: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  optionLabel: { fontSize: 16 },
  empty: { padding: spacing.lg },
});
