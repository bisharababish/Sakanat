import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
};

export function CodeBoxes({ label, value, onChangeText, length = 6 }: Props) {
  const layout = useLayout();
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);
  const digits = value.replace(/\D/g, '').slice(0, length);
  const compact = length > 6;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, layout.rtlText, { color: colors.text }]}>{label}</Text>
      <Pressable onPress={() => inputRef.current?.focus()}>
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
          onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={length}
          caretHidden
          autoCorrect={false}
          autoCapitalize="none"
          importantForAutofill="yes"
          style={styles.hidden}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
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
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.02,
    color: 'transparent',
  },
});
