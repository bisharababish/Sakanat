import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, spacing } from '@/src/theme/colors';

export function EmptyState({ title }: { title: string }) {
  const { textAlign } = useLayout();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { textAlign }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.xl,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
  },
  text: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
});
