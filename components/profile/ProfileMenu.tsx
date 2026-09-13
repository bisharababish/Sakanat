import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/LanguageToggle';
import { HubRow } from '@/components/ui/HubRow';
import { useLayout } from '@/src/hooks/useLayout';
import { useColors, useTheme, type ThemePreference } from '@/src/theme/ThemeProvider';
import { radius } from '@/src/theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ProfileMenuLink = {
  key: string;
  icon: IconName;
  label: string;
  hint?: string;
  dot?: boolean;
  danger?: boolean;
  onPress: () => void;
};

export function ProfileMenu({
  links,
  onLogout,
}: {
  links: ProfileMenuLink[];
  onLogout?: () => void;
}) {
  const { t } = useTranslation();
  const { row, rtlText, lang } = useLayout();
  const colors = useColors();
  const { preference, setPreference, scheme } = useTheme();

  const themeHint =
    preference === 'system'
      ? `${t('menu.system')} · ${scheme === 'dark' ? t('menu.dark') : t('menu.light')}`
      : t(`menu.${preference}` as const);

  const cycleTheme = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setPreference(next);
  };

  return (
    <View style={styles.list}>
      {links.map((item) => (
        <HubRow
          key={item.key}
          icon={item.icon}
          label={item.label}
          hint={item.hint}
          dot={item.dot}
          danger={item.danger}
          onPress={item.onPress}
        />
      ))}

      <HubRow
        icon="globe-outline"
        label={t('common.language')}
        hint={lang === 'ar' ? t('common.arabic') : t('common.english')}
        trailing={<LanguageToggle />}
      />

      <Pressable
        onPress={cycleTheme}
        accessibilityRole="button"
        accessibilityLabel={t('menu.appearance')}
        style={({ pressed }) => [
          styles.rowCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={[styles.rowInner, row]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons
              name={preference === 'dark' || (preference === 'system' && scheme === 'dark') ? 'moon' : 'sunny'}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('menu.appearance')}</Text>
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{themeHint}</Text>
          </View>
          <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
        </View>
      </Pressable>

      {onLogout ? (
        <HubRow icon="log-out-outline" label={t('common.logout')} danger onPress={onLogout} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  rowCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: { opacity: 0.92 },
  rowInner: { alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 15, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
});
