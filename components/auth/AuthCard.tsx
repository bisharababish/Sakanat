import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { elevation, radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function AuthCard({ children, compact }: { children: ReactNode; compact?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        compact ? styles.compact : null,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation.card,
  },
  compact: {
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
    flexShrink: 1,
    overflow: 'hidden',
  },
});
