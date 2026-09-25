import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

/** Lightweight list placeholder while the first fetch runs. */
export function ListSkeleton({ rows = 4, cover }: { rows?: number; cover?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {cover ? <View style={[styles.cover, { backgroundColor: colors.surfaceMuted }]} /> : null}
          <View style={styles.body}>
            <View style={[styles.line, { backgroundColor: colors.surfaceMuted, width: '72%' }]} />
            <View style={[styles.line, { backgroundColor: colors.surfaceMuted, width: '44%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: { height: 88 },
  body: { gap: 8, padding: spacing.md },
  line: { height: 10, borderRadius: 5 },
});
