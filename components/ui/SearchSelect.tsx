import { type ComponentProps, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  compact?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function SearchSelect({ label, value, placeholder, options, onChange, compact, icon }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { t } = useTranslation();
  const { rtlText, textAlign, writingDirection, alignStart, isRtl } = useLayout();
  const selected = options.find((option) => option.value === value);
  const active = Boolean(value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <View style={styles.wrap}>
      {compact ? null : <Text style={[styles.label, rtlText]}>{label}</Text>}
      <Pressable
        accessibilityLabel={label}
        style={[
          compact ? styles.compact : styles.field,
          compact && active ? styles.compactOn : null,
          compact ? { flexDirection: isRtl ? 'row-reverse' : 'row' } : null,
        ]}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        {compact && icon ? (
          <Ionicons name={icon} size={16} color={active ? colors.primary : colors.textMuted} />
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            compact ? styles.compactValue : styles.value,
            { textAlign, writingDirection },
            !selected && styles.placeholder,
            compact && active ? styles.compactValueOn : null,
          ]}
        >
          {selected?.label ?? placeholder}
        </Text>
        {compact ? (
          <Ionicons name="chevron-down" size={14} color={active ? colors.primary : colors.textMuted} />
        ) : null}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={[styles.sheetHead, { alignItems: alignStart }]}>
              <BackButton onPress={() => setOpen(false)} />
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('common.search')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              style={[styles.search, { textAlign }]}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={[styles.empty, rtlText]}>{t('common.noResults')}</Text>
              ) : null}
              {filtered.map((option) => (
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
  compact: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    minHeight: 44,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  compactOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  compactValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
    color: colors.text,
  },
  compactValueOn: { color: colors.primary },
  value: { fontSize: 16, color: colors.text },
  placeholder: { color: colors.textMuted },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sheetHead: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  search: {
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: { fontSize: 16, color: colors.text },
  empty: { padding: spacing.lg, color: colors.textMuted },
});
