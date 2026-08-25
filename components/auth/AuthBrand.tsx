import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export function AuthBrand({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();

  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, compact && styles.markSm]}>
        <Ionicons name="home" size={compact ? 26 : 32} color={colors.primary} />
        <View style={styles.gold} />
      </View>
      <Text style={[styles.name, compact && styles.nameSm, rtlText]}>{t('appName')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, marginBottom: 8 },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
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
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  name: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.primary,
    textAlign: 'center',
  },
  nameSm: { fontSize: 20, lineHeight: 28 },
});
