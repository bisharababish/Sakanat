import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  hint?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  ltr?: boolean;
  soft?: boolean;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  hint,
  autoCapitalize,
  autoCorrect,
  ltr,
  soft,
}: Props) {
  const layout = useLayout();
  const inputAlign = ltr ? 'left' : layout.textAlign;
  const writingDirection = ltr ? 'ltr' : layout.writingDirection;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, layout.rtlText]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        multiline={multiline}
        textAlign={inputAlign}
        style={[
          styles.input,
          soft ? styles.soft : null,
          { writingDirection },
          multiline ? styles.multiline : null,
        ]}
      />
      {hint ? <Text style={[styles.hint, layout.rtlText]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    fontSize: 16,
    color: colors.text,
  },
  soft: {
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
    borderRadius: radius.full,
    minHeight: 54,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12, borderRadius: radius.lg },
  hint: { color: colors.textMuted, fontSize: 12 },
});
