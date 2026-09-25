import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export function AuthHeading({
  title,
  hint,
  compact,
  dense,
}: {
  title: string;
  hint?: string;
  compact?: boolean;
  dense?: boolean;
}) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();

  return (
    <View style={[styles.wrap, (compact || dense) && styles.wrapCompact, dense && styles.wrapDense]}>
      <Text
        style={[
          styles.kicker,
          compact && styles.kickerCompact,
          dense && styles.kickerDense,
          rtlText,
          { color: colors.primary },
        ]}
      >
        {t('appName')}
      </Text>
      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
          dense && styles.titleDense,
          rtlText,
          { color: colors.primaryDark },
        ]}
      >
        {title}
      </Text>
      {hint ? (
        <Text
          style={[styles.hint, compact && styles.hintCompact, dense && styles.hintDense, rtlText, { color: colors.textMuted }]}
          numberOfLines={dense ? 2 : undefined}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 4 },
  wrapCompact: { gap: 4, marginBottom: 0 },
  wrapDense: { gap: 2, marginBottom: 0 },
  kicker: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  kickerCompact: { fontSize: 14 },
  kickerDense: { fontSize: 13 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    lineHeight: 34,
  },
  titleCompact: { fontSize: 22, lineHeight: 28 },
  titleDense: { fontSize: 20, lineHeight: 26 },
  hint: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  hintCompact: { fontSize: 13, lineHeight: 18 },
  hintDense: { fontSize: 12, lineHeight: 16 },
});
