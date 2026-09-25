import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

/** Shared tab-root header: accent kicker + title (+ optional hint / trailing). */
export function TabPageHeader({
  kicker,
  title,
  hint,
  trailing,
}: {
  kicker?: string;
  title: string;
  hint?: string;
  trailing?: ReactNode;
}) {
  const { rtlText, row } = useLayout();
  const colors = useColors();

  return (
    <View style={[styles.top, row]}>
      <View style={styles.copy}>
        {kicker ? (
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]} numberOfLines={1}>
            {kicker}
          </Text>
        ) : null}
        <Text style={[styles.title, rtlText, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {hint ? (
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', lineHeight: 28 },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 18, marginTop: 2 },
});
