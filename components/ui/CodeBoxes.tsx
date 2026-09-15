import * as Clipboard from 'expo-clipboard';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
};

function codeFrom(text: string, length: number) {
  return text.replace(/\D/g, '').slice(0, length);
}

export function CodeBoxes({ label, value, onChangeText, length = 6 }: Props) {
  const { t } = useTranslation();
  const layout = useLayout();
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);
  const digits = codeFrom(value, length);
  const compact = length > 6;

  const applyCode = (next: string) => {
    const code = codeFrom(next, length);
    if (code) onChangeText(code);
  };

  const pasteCode = async () => {
    try {
      applyCode(await Clipboard.getStringAsync());
    } catch {
      // Keyboard entry still works.
    }
    inputRef.current?.focus();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.label, layout.rtlText, { color: colors.text }]}>{label}</Text>
        <Pressable onPress={() => void pasteCode()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.paste')}>
          <Text style={[styles.paste, { color: colors.primary }]}>{t('common.paste')}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => void pasteCode()}>
        <View style={[styles.row, compact ? styles.rowCompact : null]}>
          {Array.from({ length }, (_, index) => {
            const active = digits.length === index;
            const filled = Boolean(digits[index]);
            return (
              <View
                key={index}
                style={[
                  styles.box,
                  compact ? styles.boxCompact : null,
                  {
                    borderColor: active || filled ? colors.primary : colors.border,
                    backgroundColor: colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={[styles.digit, compact ? styles.digitCompact : null, { color: colors.text }]}>
                  {digits[index] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          value={digits}
          onChangeText={(next) => applyCode(next)}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={length}
          caretHidden
          autoCorrect={false}
          autoCapitalize="none"
          importantForAutofill="yes"
          pointerEvents="none"
          style={styles.hidden}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { flex: 1, fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  paste: { fontSize: 14, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  row: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 8,
  },
  rowCompact: { gap: 4 },
  box: {
    flex: 1,
    minHeight: 58,
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxCompact: { minHeight: 48, borderWidth: 1.5 },
  digit: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    lineHeight: 32,
  },
  digitCompact: { fontSize: 18, lineHeight: 24 },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
