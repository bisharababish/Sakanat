import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

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
  maxLength?: number;
  editable?: boolean;
  selectTextOnFocus?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
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
  maxLength,
  editable,
  selectTextOnFocus,
  autoComplete,
  textContentType,
}: Props) {
  const { t } = useTranslation();
  const layout = useLayout();
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const hidden = Boolean(secureTextEntry) && !visible;
  const inputAlign = ltr ? 'left' : layout.textAlign;
  const writingDirection = ltr ? 'ltr' : layout.writingDirection;
  const iconOnStart = Boolean(secureTextEntry) && layout.isRtl && !ltr;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, layout.rtlText, { color: colors.text }]}>{label}</Text>
      <View style={[styles.field, ltr ? styles.ltr : null]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={secureTextEntry ? 'none' : autoCapitalize}
          autoCorrect={secureTextEntry ? false : autoCorrect}
          autoComplete={secureTextEntry ? 'password' : autoComplete}
          textContentType={secureTextEntry ? 'password' : textContentType}
          multiline={Boolean(multiline)}
          numberOfLines={multiline ? 4 : 1}
          maxLength={maxLength}
          editable={editable}
          selectTextOnFocus={selectTextOnFocus}
          textAlign={inputAlign}
          style={[
            styles.input,
            soft ? styles.soft : null,
            {
              writingDirection,
              backgroundColor: soft ? colors.surfaceMuted : colors.surface,
              borderColor: soft ? 'transparent' : colors.border,
              color: colors.text,
            },
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
      {hint ? <Text style={[styles.hint, layout.rtlText, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { overflow: 'hidden' },
  ltr: { direction: 'ltr' },
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    paddingVertical: 0,
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  soft: {
    borderRadius: radius.full,
    height: 54,
  },
  padEnd: { paddingEnd: 48 },
  padStart: { paddingStart: 48 },
  multiline: { height: undefined, minHeight: 110, textAlignVertical: 'top', paddingTop: 12, borderRadius: radius.lg },
  hint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
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
