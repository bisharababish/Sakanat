import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { elevation, radius, spacing } from '@/src/theme/colors';
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
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
      ]}
    >
      <Text style={[styles.text, rtlText, { color: colors.text }]}>{title}</Text>
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
    borderRadius: radius.xl,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation.card,
  },
  text: { fontSize: 16, lineHeight: 24, fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
});
