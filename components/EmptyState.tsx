import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function EmptyState({ title }: { title: string }) {
  const { rtlText } = useLayout();
  const colors = useColors();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, shadowColor: colors.text }]}>
      <Text style={[styles.text, rtlText, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.xl,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  text: { fontSize: 15, lineHeight: 22 },
});
