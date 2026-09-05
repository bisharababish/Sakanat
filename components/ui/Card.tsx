import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { radius, spacing } from '@/src/theme/colors';
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
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  compact: {
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.92 },
});
