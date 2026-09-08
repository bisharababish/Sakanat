import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { online } = useOnlineStatus();

  if (online) return null;

  return (
    <View style={[styles.banner, row, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text style={[styles.text, rtlText, { color: colors.text }]}>{t('common.offlineHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Cairo_600SemiBold' },
});
