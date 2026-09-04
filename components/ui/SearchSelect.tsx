import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  compact?: boolean;
  clearable?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function SearchSelect({ label, value, placeholder, options, onChange, compact, clearable, icon }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { t } = useTranslation();
  const { rtlText, textAlign, writingDirection, alignStart, isRtl } = useLayout();
  const colors = useColors();
  const selected = value ? options.find((option) => option.value === value) : undefined;
  const active = Boolean(value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rest = needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
    if (!clearable || options.some((option) => option.value === '')) return rest;
    return [{ value: '', label: t('common.none') }, ...rest];
  }, [clearable, options, query, t]);

  return (
    <View style={styles.wrap}>
      {compact ? null : <Text style={[styles.label, rtlText, { color: colors.text }]}>{label}</Text>}
      <Pressable
        accessibilityLabel={label}
        style={[
          compact ? styles.compact : styles.field,
          {
            backgroundColor: compact && active ? colors.primarySoft : colors.surface,
            borderColor: compact && active ? colors.primary : colors.border,
          },
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
            { textAlign, writingDirection, color: selected ? (compact && active ? colors.primary : colors.text) : colors.textMuted },
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
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('common.search')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              style={[styles.search, { textAlign, color: colors.text, borderColor: colors.border }]}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={[styles.empty, rtlText, { color: colors.textMuted }]}>{t('common.noResults')}</Text>
              ) : null}
              {filtered.map((option) => (
                <Pressable
                  key={option.value || 'empty'}
                  style={[styles.option, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionLabel, rtlText, { color: option.value ? colors.text : colors.textMuted }]}>{option.label}</Text>
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
    maxHeight: '75%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sheetHead: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  search: {
    margin: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  option: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  optionLabel: { fontSize: 16 },
  empty: { padding: spacing.lg },
});
