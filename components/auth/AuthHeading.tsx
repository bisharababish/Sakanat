import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export function AuthHeading({ title, hint }: { title: string; hint?: string }) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('appNameLead')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    lineHeight: 34,
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
});
