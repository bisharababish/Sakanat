import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMenu } from '@/components/menu/MenuProvider';
import { useColors } from '@/src/theme/ThemeProvider';
import { radius } from '@/src/theme/colors';

export function MenuButton() {
  const { t } = useTranslation();
  const { open } = useMenu();
  const colors = useColors();

  return (
    <Pressable
      onPress={open}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('menu.title')}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.primarySoft, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Ionicons name="menu-outline" size={22} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
