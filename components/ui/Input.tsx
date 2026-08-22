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
}: Props) {
  const { textAlign, writingDirection } = useLayout();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { textAlign }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlign={textAlign}
        style={[
          styles.input,
          { writingDirection },
          multiline ? styles.multiline : null,
        ]}
      />
      {hint ? <Text style={[styles.hint, { textAlign }]}>{hint}</Text> : null}
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
  multiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  hint: { color: colors.textMuted, fontSize: 12 },
});
