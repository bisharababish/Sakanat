import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export function AuthBrand({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { writingDirection } = useLayout();

  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, compact && styles.markSm]}>
        <Ionicons name="home" size={compact ? 26 : 32} color={colors.primary} />
        <View style={styles.gold} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={[styles.name, compact && styles.nameSm, { writingDirection }]}>{t('appNameLead')}</Text>
        <Text style={[styles.tail, compact && styles.tailSm, { writingDirection }]}>{t('appNameTail')}</Text>
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
  titleBlock: { alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: 8, gap: 2 },
  name: {
    fontSize: 26,
    lineHeight: 42,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: 2,
  },
  nameSm: { fontSize: 20, lineHeight: 34 },
  tail: {
    fontSize: 20,
    lineHeight: 34,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.accent,
    textAlign: 'center',
    paddingVertical: 2,
  },
  tailSm: { fontSize: 16, lineHeight: 28 },
});
