import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function EmptyState({
  title,
  hint,
  actionTitle,
  onAction,
}: {
  title: string;
  hint?: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const { rtlText } = useLayout();
  const colors = useColors();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, shadowColor: colors.text }]}>
      <Text style={[styles.text, rtlText, { color: colors.textMuted }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{hint}</Text> : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} variant="secondary" pill onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.xl,
    borderRadius: 24,
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  text: { fontSize: 15, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
});
