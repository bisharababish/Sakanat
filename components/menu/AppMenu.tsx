import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { type ComponentProps, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/LanguageToggle';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { alert } from '@/src/lib/notice';
import { getPushEnabled, setPushEnabled } from '@/src/lib/push';
import { mailTo } from '@/src/lib/support';
import { radius, spacing } from '@/src/theme/colors';
import { useColors, useTheme, type ThemePreference } from '@/src/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

const OPEN = { duration: 340, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const CLOSE = { duration: 240, easing: Easing.in(Easing.cubic) };

const THEMES: { id: ThemePreference; icon: IconName }[] = [
  { id: 'light', icon: 'sunny-outline' },
  { id: 'dark', icon: 'moon-outline' },
  { id: 'system', icon: 'phone-portrait-outline' },
];

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function AppMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { isRtl, row, textAlign, writingDirection } = useLayout();
  const { profile, signOut } = useAuth();
  const colors = useColors();
  const { preference, setPreference } = useTheme();
  const { width } = useWindowDimensions();
  const [pushOn, setPushOn] = useState(true);
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);
  const copy = { textAlign, writingDirection };
  const sheetWidth = Math.min(340, Math.round(width * 0.84));

  useEffect(() => {
    if (!visible) return;
    void getPushEnabled().then(setPushOn);
  }, [visible]);

  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    progress.value = withTiming(visible ? 1 : 0, visible ? OPEN : CLOSE, (finished) => {
      if (finished && !visible) runOnJS(setOpen)(false);
    });
  }, [open, progress, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [sheetWidth, 0]) }],
  }));

  const togglePush = async (next: boolean) => {
    setPushOn(next);
    await setPushEnabled(next, profile?.id);
  };

  const logout = () => {
    alert(t('common.logout'), t('common.confirmLogout'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: () => {
          onClose();
          void signOut();
        },
      },
    ]);
  };

  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.frame}>
        <Animated.View style={[styles.dim, overlayStyle, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              width: sheetWidth,
              backgroundColor: colors.background,
              shadowColor: colors.text,
            },
          ]}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.sheetInner}>
            <View style={[styles.head, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, copy, { color: colors.primaryDark }]}>{t('menu.title')}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {profile ? (
                <View style={[styles.hero, row, { backgroundColor: colors.primary }]}>
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.initials, { color: colors.primary }]}>{initials(profile.full_name)}</Text>
                    </View>
                  )}
                  <View style={styles.heroCopy}>
                    <Text style={[styles.heroName, copy]} numberOfLines={1}>
                      {profile.full_name}
                    </Text>
                    <View style={[styles.roleChip, { alignSelf: isRtl ? 'flex-end' : 'flex-start' }]}>
                      <Text style={styles.roleChipText}>{t(`roles.${profile.role}`)}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <Text style={[styles.section, copy, { color: colors.textMuted }]}>{t('menu.preferences')}</Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.row, row]}>
                  <RowIcon name="language-outline" colors={colors} />
                  <Text style={[styles.rowLabel, copy, { color: colors.text }]}>{t('common.language')}</Text>
                  <LanguageToggle />
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={[styles.appearanceHead, row]}>
                  <RowIcon name="color-palette-outline" colors={colors} />
                  <Text style={[styles.rowLabel, copy, { color: colors.text }]}>{t('menu.appearance')}</Text>
                </View>
                <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  {THEMES.map((item) => {
                    const on = preference === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setPreference(item.id)}
                        style={[
                          styles.segmentBtn,
                          on && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Ionicons name={item.icon} size={16} color={on ? colors.white : colors.textMuted} />
                        <Text style={[styles.segmentText, { color: on ? colors.white : colors.text }]}>
                          {t(`menu.${item.id}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {profile ? (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <View style={[styles.row, row]}>
                      <RowIcon name="notifications-outline" colors={colors} />
                      <View style={styles.rowCopy}>
                        <Text style={[styles.rowLabel, copy, { color: colors.text }]}>{t('menu.notifications')}</Text>
                        <Text style={[styles.hint, copy, { color: colors.textMuted }]}>{t('menu.notificationsHint')}</Text>
                      </View>
                      <Switch
                        value={pushOn}
                        onValueChange={(next) => void togglePush(next)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.white}
                      />
                    </View>
                  </>
                ) : null}
              </View>

              <Text style={[styles.section, copy, { color: colors.textMuted }]}>{t('menu.help')}</Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MenuLink
                  icon="mail-outline"
                  label={t('menu.contact')}
                  colors={colors}
                  copy={copy}
                  row={row}
                  isRtl={isRtl}
                  onPress={() => void Linking.openURL(mailTo(t('menu.contactSubject')))}
                />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <MenuLink
                  icon="help-circle-outline"
                  label={t('menu.support')}
                  colors={colors}
                  copy={copy}
                  row={row}
                  isRtl={isRtl}
                  onPress={() => void Linking.openURL(mailTo(t('menu.supportSubject')))}
                />
              </View>

              {profile ? (
                <Pressable
                  onPress={logout}
                  style={[styles.logout, row, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
                >
                  <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                  <Text style={[styles.logoutText, copy, { color: colors.danger }]}>{t('common.logout')}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function RowIcon({ name, colors }: { name: IconName; colors: { primary: string; primarySoft: string } }) {
  return (
    <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
      <Ionicons name={name} size={18} color={colors.primary} />
    </View>
  );
}

function MenuLink({
  icon,
  label,
  onPress,
  colors,
  copy,
  row,
  isRtl,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: { primary: string; primarySoft: string; text: string; textMuted: string };
  copy: { textAlign: 'left' | 'right'; writingDirection: 'ltr' | 'rtl' };
  row: { flexDirection: 'row' | 'row-reverse' };
  isRtl: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, row]}>
      <RowIcon name={icon} colors={colors} />
      <Text style={[styles.rowLabel, copy, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  dim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    overflow: 'hidden',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  sheetInner: { flex: 1 },
  head: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  title: { flex: 1, minWidth: 0, fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: { width: 48, height: 48, borderRadius: 16 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  roleChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleChipText: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  section: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_700Bold', marginTop: 4 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },
  segment: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 4,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  segmentText: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  logoutText: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
});
