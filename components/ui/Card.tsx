import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { elevation, radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  compact?: boolean;
};

export function Card({ children, onPress, onLayout, compact }: Props) {
  const colors = useColors();
  const style = [
    styles.card,
    compact ? styles.compact : null,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      shadowColor: colors.text,
    },
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} onLayout={onLayout} style={({ pressed }) => [style, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={style} onLayout={onLayout}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    overflow: 'hidden',
    alignSelf: 'stretch',
    maxWidth: '100%',
    ...elevation.card,
  },
  compact: {
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.995 }] },
});
