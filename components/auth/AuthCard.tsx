import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function AuthCard({ children, compact }: { children: ReactNode; compact?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        compact ? styles.compact : null,
        { backgroundColor: colors.surface, shadowColor: colors.text },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  compact: {
    borderRadius: 24,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
