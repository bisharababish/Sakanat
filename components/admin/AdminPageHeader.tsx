import { StyleSheet, Text } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export function AdminPageHeader({
  kicker,
  title,
  hint,
}: {
  kicker?: string;
  title: string;
  hint?: string;
}) {
  const { rtlText } = useLayout();
  const colors = useColors();
  return (
    <>
      {kicker ? <Text style={[styles.kicker, rtlText, { color: colors.primary }]}>{kicker}</Text> : null}
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{hint}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
});
