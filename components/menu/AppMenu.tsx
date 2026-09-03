import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { getPushEnabled, setPushEnabled } from '@/src/lib/push';
import { profileHref } from '@/src/lib/routes';
import { appVersion, mailTo, rateUrl, SUPPORT_EMAIL, supportWhatsAppUrl } from '@/src/lib/support';
import { radius, spacing } from '@/src/theme/colors';
import { useColors, useTheme, type ThemePreference } from '@/src/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Pane = 'root' | 'how' | 'privacy' | 'terms';

const OPEN = { duration: 340, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const CLOSE = { duration: 240, easing: Easing.in(Easing.cubic) };
const VERSION = appVersion();

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
  const { t, i18n } = useTranslation();
  const { isRtl, row, textAlign, writingDirection } = useLayout();
  const { profile, signOut } = useAuth();
  const colors = useColors();
  const { preference, setPreference } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const [pushOn, setPushOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>('root');
  const [askLogout, setAskLogout] = useState(false);
  const pendingSignOut = useRef(false);
  const rootScroll = useRef<ScrollView>(null);
  const rootY = useRef(0);
  const progress = useSharedValue(0);
  const copy = { textAlign, writingDirection };
  const sheetWidth = Math.min(340, Math.round(width * 0.84));
  const university = localizedName(profile?.universities, i18n.language);
  const city = localizedName(profile?.cities, i18n.language);

  useEffect(() => {
    if (!visible) return;
    void getPushEnabled().then(setPushOn);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      return;
    }
    setPane('root');
    setAskLogout(false);
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    progress.value = withTiming(visible ? 1 : 0, visible ? OPEN : CLOSE, (finished) => {
      if (finished && !visible) runOnJS(setOpen)(false);
    });
  }, [open, progress, visible]);

  useEffect(() => {
    if (open || !pendingSignOut.current) return;
    pendingSignOut.current = false;
    void signOut();
  }, [open, signOut]);

  useEffect(() => {
    if (pane !== 'root') return;
    const y = rootY.current;
    if (y <= 0) return;
    requestAnimationFrame(() => {
      rootScroll.current?.scrollTo({ y, animated: false });
    });
  }, [pane]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const startX = isRtl ? -sheetWidth : sheetWidth;
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [startX, 0]) }],
  }));

  const togglePush = async (next: boolean) => {
    setPushOn(next);
    await setPushEnabled(next, profile?.id);
  };

  const goProfile = () => {
    if (!profile) return;
    onClose();
    router.push(profileHref(profile.role) as never);
  };

  const openUrl = (url: string) => {
    void Linking.openURL(url);
  };

  const openWhatsApp = () => {
    const url = supportWhatsAppUrl(t('menu.whatsappPrefill'));
    if (url) {
      openUrl(url);
      return;
    }
    alert(t('menu.whatsapp'), t('menu.whatsappMissing'));
    openUrl(mailTo(t('menu.supportSubject')));
  };

  const report = () => {
    const role = profile ? t(`roles.${profile.role}`) : t('menu.guest');
    openUrl(mailTo(t('menu.reportSubject'), t('menu.reportBody', { role, version: VERSION })));
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message: t('menu.shareMessage', { name: t('appName'), tagline: t('tagline') }),
      });
    } catch {
      // user dismissed the sheet
    }
  };

  const rateApp = async () => {
    const url = rateUrl();
    if (url) {
      openUrl(url);
      return;
    }
    alert(t('menu.rate'), t('menu.rateSoon'));
  };

  const confirmLogout = () => {
    pendingSignOut.current = true;
    onClose();
  };

  const paneTitle = pane === 'how' ? t('menu.how') : pane === 'privacy' ? t('menu.privacy') : t('menu.terms');
  const paneBody =
    pane === 'how'
      ? t('menu.howBody')
      : pane === 'privacy'
        ? t('menu.privacyBody', { email: SUPPORT_EMAIL })
        : t('menu.termsBody', { email: SUPPORT_EMAIL });

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
              backgroundColor: colors.surface,
              shadowColor: colors.text,
              left: isRtl ? 0 : undefined,
              right: isRtl ? undefined : 0,
              borderTopLeftRadius: isRtl ? 0 : radius.xl,
              borderBottomLeftRadius: isRtl ? 0 : radius.xl,
              borderTopRightRadius: isRtl ? radius.xl : 0,
              borderBottomRightRadius: isRtl ? radius.xl : 0,
            },
          ]}
        >
          <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
            <View style={[styles.head, { backgroundColor: colors.primary, paddingTop: topInset + spacing.sm }]}>
              {pane !== 'root' ? (
                <Pressable
                  onPress={() => setPane('root')}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back')}
                  style={styles.headBtn}
                >
                  <Ionicons name={isRtl ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.white} />
                </Pressable>
              ) : (
                <View style={styles.headBtn} />
              )}
              <Text style={[styles.title, copy]}>
                {pane === 'root' ? t('appNameLead') : paneTitle}
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={styles.headBtn}
              >
                <Ionicons name="close" size={20} color={colors.white} />
              </Pressable>
            </View>

            <View style={styles.flex}>
              <ScrollView
                ref={rootScroll}
                style={[styles.flex, pane !== 'root' ? styles.paneHidden : null, { backgroundColor: colors.background }]}
                contentContainerStyle={[styles.body, { backgroundColor: colors.background }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                pointerEvents={pane === 'root' ? 'auto' : 'none'}
                scrollEventThrottle={16}
                onScroll={(event) => {
                  rootY.current = event.nativeEvent.contentOffset.y;
                }}
              >
                {profile ? (
                  <Pressable
                    onPress={goProfile}
                    style={({ pressed }) => [
                      styles.hero,
                      row,
                      { backgroundColor: colors.primarySoft, opacity: pressed ? 0.9 : 1 },
                    ]}
                  >
                    {profile.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.initials, { color: colors.white }]}>{initials(profile.full_name)}</Text>
                      </View>
                    )}
                    <View style={styles.heroCopy}>
                      <Text style={[styles.heroName, copy, { color: colors.primaryDark }]} numberOfLines={2}>
                        {profile.full_name}
                      </Text>
                      <Text style={[styles.heroRole, copy, { color: colors.primary }]}>{t(`roles.${profile.role}`)}</Text>
                      {profile.email ? (
                        <Text style={[styles.heroMeta, copy, { color: colors.text }]}>{profile.email}</Text>
                      ) : null}
                      {profile.role === 'student' && university ? (
                        <Text style={[styles.heroMeta, copy, { color: colors.textMuted }]} numberOfLines={1}>
                          {university}
                        </Text>
                      ) : city ? (
                        <Text style={[styles.heroMeta, copy, { color: colors.textMuted }]} numberOfLines={1}>
                          {city}
                        </Text>
                      ) : null}
                      <Text style={[styles.heroLink, copy, { color: colors.primary }]}>{t('menu.profile')}</Text>
                    </View>
                    <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.primary} />
                  </Pressable>
                ) : (
                  <View style={[styles.guestCard, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.guestName, copy, { color: colors.primaryDark }]}>{t('appName')}</Text>
                    <Text style={[styles.heroMeta, copy, { color: colors.textMuted }]}>{t('tagline')}</Text>
                    <Button
                      title={t('auth.login')}
                      pill
                      onPress={() => {
                        onClose();
                        router.push('/(auth)/login');
                      }}
                    />
                  </View>
                )}

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
                        <Text style={[styles.rowLabel, copy, { color: colors.text }]}>{t('menu.notifications')}</Text>
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
                  <MenuLink icon="book-outline" label={t('menu.how')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => setPane('how')} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink icon="logo-whatsapp" label={t('menu.whatsapp')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={openWhatsApp} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink
                    icon="mail-outline"
                    label={t('menu.contact')}
                    colors={colors}
                    copy={copy}
                    row={row}
                    isRtl={isRtl}
                    onPress={() => openUrl(mailTo(t('menu.contactSubject')))}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink icon="flag-outline" label={t('menu.report')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={report} />
                </View>

                <Text style={[styles.section, copy, { color: colors.textMuted }]}>{t('menu.about')}</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MenuLink icon="shield-checkmark-outline" label={t('menu.privacy')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => setPane('privacy')} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink icon="document-text-outline" label={t('menu.terms')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => setPane('terms')} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink icon="share-social-outline" label={t('menu.share')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => void shareApp()} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink icon="star-outline" label={t('menu.rate')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => void rateApp()} />
                </View>
                <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                  {t('menu.version', { version: VERSION })}
                </Text>
              </ScrollView>
              {pane !== 'root' ? (
                <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.article, copy, { color: colors.text }]}>{paneBody}</Text>
                </ScrollView>
              ) : null}
            </View>
            {pane === 'root' && profile ? (
              <View style={[styles.logoutBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                {askLogout ? (
                  <View style={styles.confirmBox}>
                    <Text style={[styles.confirmText, copy, { color: colors.text }]}>{t('common.confirmLogout')}</Text>
                    <View style={styles.confirmActions}>
                      <View style={styles.confirmBtn}>
                        <Button title={t('common.no')} variant="ghost" pill onPress={() => setAskLogout(false)} />
                      </View>
                      <View style={styles.confirmBtn}>
                        <Button title={t('common.yes')} variant="danger" pill onPress={confirmLogout} />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Button title={t('common.logout')} variant="danger" pill onPress={() => setAskLogout(true)} />
                )}
              </View>
            ) : null}
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, row, pressed && styles.rowPressed]}>
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
    overflow: 'hidden',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  sheetInner: { flex: 1 },
  flex: { flex: 1 },
  paneHidden: { display: 'none' },
  head: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: '#fff',
  },
  headBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: { width: 58, height: 58, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroCopy: { flex: 1, minWidth: 0, gap: 3 },
  heroName: { fontSize: 17, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroRole: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  heroMeta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  heroLink: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginTop: 2 },
  guestCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 8,
  },
  aboutCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 8,
  },
  guestName: { fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  section: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_700Bold', marginTop: 4 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  rowPressed: { opacity: 0.7 },
  appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  article: { fontSize: 15, lineHeight: 26, fontFamily: 'Cairo_400Regular' },
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
  logoutBar: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  confirmBox: { gap: spacing.sm },
  confirmText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  confirmActions: { flexDirection: 'row', direction: 'ltr', gap: 8 },
  confirmBtn: { flex: 1 },
});
