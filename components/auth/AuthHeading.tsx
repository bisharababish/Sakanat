import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export function AuthHeading({ title, hint, compact }: { title: string; hint?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.kicker, compact && styles.kickerCompact, rtlText, { color: colors.accent }]}>{t('appNameLead')}</Text>
      <Text style={[styles.title, compact && styles.titleCompact, rtlText, { color: colors.primaryDark }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.hint, compact && styles.hintCompact, rtlText, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 4 },
  wrapCompact: { gap: 4, marginBottom: 0 },
  kicker: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  kickerCompact: { fontSize: 12 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    lineHeight: 34,
  },
  titleCompact: { fontSize: 22, lineHeight: 28 },
  hint: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  hintCompact: { fontSize: 13, lineHeight: 18 },
});
