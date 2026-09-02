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

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, layout.rtlText, { color: colors.text }]}>{label}</Text>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <View style={styles.row}>
          {Array.from({ length }, (_, index) => {
            const active = digits.length === index;
            const filled = Boolean(digits[index]);
            return (
              <View
                key={index}
                style={[
                  styles.box,
                  {
                    borderColor: active || filled ? colors.primary : colors.border,
                    backgroundColor: colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={[styles.digit, { color: colors.text }]}>{digits[index] ?? ''}</Text>
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
  box: {
    flex: 1,
    minHeight: 58,
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    lineHeight: 32,
  },
  hidden: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
  },
});
