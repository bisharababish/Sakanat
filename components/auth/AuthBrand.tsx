import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export function AuthBrand({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { writingDirection } = useLayout();
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, compact && styles.markSm, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="home" size={compact ? 26 : 32} color={colors.primary} />
        <View style={[styles.gold, { backgroundColor: colors.accent, borderColor: colors.primarySoft }]} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={[styles.name, compact && styles.nameSm, { writingDirection, color: colors.primary }]}>{t('appNameLead')}</Text>
        <Text style={[styles.tail, compact && styles.tailSm, { writingDirection, color: colors.accent }]}>{t('appNameTail')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch', gap: 12, marginBottom: 8 },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSm: { width: 56, height: 56, borderRadius: 28 },
  gold: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  titleBlock: { alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: 8, gap: 2 },
  name: {
    fontSize: 26,
    lineHeight: 42,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    paddingVertical: 2,
  },
  nameSm: { fontSize: 20, lineHeight: 34 },
  tail: {
    fontSize: 20,
    lineHeight: 34,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    paddingVertical: 2,
  },
  tailSm: { fontSize: 16, lineHeight: 28 },
});
