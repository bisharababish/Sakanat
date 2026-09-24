import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  pill?: boolean;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, pill, compact }: Props) {
  const { writingDirection } = useLayout();
  const colors = useColors();
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
        pill ? styles.pill : null,
        compact ? styles.compact : null,
        compact && pill ? styles.compactPill : null,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.label, compact && styles.compactLabel, { color: palette.text, writingDirection }]}>
          {title}
        </Text>
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
    fontFamily: 'Cairo_700Bold',
    letterSpacing: -0.2,
  },
  pill: { borderRadius: radius.full, minHeight: 52 },
  compact: { minHeight: 38, paddingHorizontal: 14 },
  compactPill: { minHeight: 38 },
  compactLabel: { fontSize: 13 },
});
