import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export function goBack() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}

export function BackButton({ onPress, compact }: { onPress?: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const { isRtl, row } = useLayout();

  return (
    <Pressable
      onPress={onPress ?? goBack}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      style={({ pressed }) => [styles.btn, row, pressed && styles.pressed]}>
      <Ionicons
        name={isRtl ? 'chevron-forward' : 'chevron-back'}
        size={24}
        color={colors.primary}
      />
      {compact ? null : <Text style={styles.label}>{t('common.back')}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    minHeight: 44,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  label: { color: colors.primary, fontWeight: '800', fontSize: 16 },
});
