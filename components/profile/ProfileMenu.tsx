import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/LanguageToggle';
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

function MenuRow({
  icon,
  label,
  hint,
  dot,
  danger,
  trailing,
  last,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  dot?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
  last?: boolean;
  onPress?: () => void;
}) {
  const { row, rtlText, isRtl } = useLayout();
  const colors = useColors();
  const tint = danger ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <View style={[styles.rowInner, row]}>
        <View style={[styles.iconWrap, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.label, rtlText, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
          {hint ? (
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        {trailing ?? (
          <View style={styles.trail}>
            {dot ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
            {onPress ? <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} /> : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function ProfileMenu({
  links,
  onLogout,
}: {
  links: ProfileMenuLink[];
  onLogout?: () => void;
}) {
  const { t } = useTranslation();
  const { lang } = useLayout();
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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {links.map((item) => (
        <MenuRow
          key={item.key}
          icon={item.icon}
          label={item.label}
          hint={item.hint}
          dot={item.dot}
          danger={item.danger}
          onPress={item.onPress}
        />
      ))}
      <MenuRow
        icon="globe-outline"
        label={t('common.language')}
        hint={lang === 'ar' ? t('common.arabic') : t('common.english')}
        trailing={<LanguageToggle />}
        last={false}
      />
      <MenuRow
        icon={preference === 'dark' || (preference === 'system' && scheme === 'dark') ? 'moon' : 'sunny'}
        label={t('menu.appearance')}
        hint={themeHint}
        last={!onLogout}
        onPress={cycleTheme}
      />
      {onLogout ? (
        <MenuRow icon="log-out-outline" label={t('common.logout')} danger last onPress={onLogout} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pressed: { opacity: 0.88 },
  rowInner: { alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  label: { fontSize: 15, fontFamily: 'Cairo_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
