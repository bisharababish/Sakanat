import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const layout = useLayout();
  const [visible, setVisible] = useState(false);
  const hidden = Boolean(secureTextEntry) && !visible;
  const inputAlign = ltr ? 'left' : layout.textAlign;
  const writingDirection = ltr ? 'ltr' : layout.writingDirection;
  const iconOnStart = Boolean(secureTextEntry) && layout.isRtl && !ltr;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, layout.rtlText]}>{label}</Text>
      <View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={secureTextEntry ? 'none' : autoCapitalize}
          autoCorrect={secureTextEntry ? false : autoCorrect}
          autoComplete={secureTextEntry ? 'password' : undefined}
          textContentType={secureTextEntry ? 'password' : undefined}
          multiline={multiline}
          textAlign={inputAlign}
          style={[
            styles.input,
            soft ? styles.soft : null,
            { writingDirection },
            multiline ? styles.multiline : null,
            secureTextEntry ? (iconOnStart ? styles.padStart : styles.padEnd) : null,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={visible ? t('common.hidePassword') : t('common.showPassword')}
            style={[styles.eye, iconOnStart ? styles.eyeStart : styles.eyeEnd]}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
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
  padEnd: { paddingEnd: 48 },
  padStart: { paddingStart: 48 },
  multiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12, borderRadius: radius.lg },
  hint: { color: colors.textMuted, fontSize: 12 },
  eye: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeEnd: { end: 0 },
  eyeStart: { start: 0 },
});
