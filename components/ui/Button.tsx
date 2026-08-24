import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading }: Props) {
  const { writingDirection } = useLayout();
  const palette = {
    primary: { bg: colors.primary, text: colors.white, border: colors.primary },
    secondary: { bg: colors.accentSoft, text: colors.primaryDark, border: colors.accent },
    ghost: { bg: 'transparent', text: colors.primary, border: colors.border },
    danger: { bg: colors.dangerSoft, text: colors.danger, border: colors.danger },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.label, { color: palette.text, writingDirection }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
