import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { alert } from '@/src/lib/notice';
import { colors, radius } from '@/src/theme/colors';

export function LogoutButton() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { row } = useLayout();

  const confirmLogout = () => {
    alert(t('common.logout'), t('common.confirmLogout'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('common.yes'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Pressable
      onPress={confirmLogout}
      accessibilityRole="button"
      accessibilityLabel={t('common.logout')}
      style={({ pressed }) => [styles.btn, row, { opacity: pressed ? 0.82 : 1 }]}
    >
      <Ionicons name="log-out-outline" size={18} color={colors.white} />
      <Text style={styles.label}>{t('common.logout')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  label: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Cairo_700Bold',
  },
});
