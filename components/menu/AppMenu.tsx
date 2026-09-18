import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/LanguageToggle';
import { FaqList } from '@/components/menu/FaqList';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { useLayout } from '@/src/hooks/useLayout';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { displayName } from '@/src/lib/name';
import { alert } from '@/src/lib/notice';
import { loadMyReports, reportStatusLabel, submitAppReport } from '@/src/lib/reports';
import { openLogin, openRegister } from '@/src/lib/guest';
import { profileHref, type ProfileTab } from '@/src/lib/routes';
import { appVersion, COPYRIGHT_YEAR, INSTAGRAM_HANDLE, instagramUrl, mailTo, rateUrl, SUPPORT_EMAIL, supportWhatsAppUrl, TRUST_EMAIL } from '@/src/lib/support';
import { accountVerification } from '@/src/lib/trust';
import { radius, spacing } from '@/src/theme/colors';
import { useColors, useTheme, type ThemePreference } from '@/src/theme/ThemeProvider';
import type { AppReport } from '@/src/types/database';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Pane = 'root' | 'faq' | 'privacy' | 'terms' | 'report';

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
  const { session, profile, signOut } = useAuth();
  const signedIn = Boolean(session && profile);
  const colors = useColors();
  const { preference, setPreference } = useTheme();
  const { width } = useWindowDimensions();
  const { top: topInset } = useModalSafeArea();
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>('root');
  const [askLogout, setAskLogout] = useState(false);
  const [reportKind, setReportKind] = useState<'tech' | 'safety'>('safety');
  const [reportBody, setReportBody] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [myReports, setMyReports] = useState<AppReport[]>([]);
  const rootScroll = useRef<ScrollView>(null);
  const rootY = useRef(0);
  const progress = useSharedValue(0);
  const copy = { textAlign, writingDirection };
  const sheetWidth = Math.min(340, Math.round(width * 0.84));
  const shownName = displayName(profile, i18n.language);
  const university = localizedName(profile?.universities, i18n.language);
  const city = localizedName(profile?.cities, i18n.language);
  const verification = accountVerification(profile);
  const isSeeker = signedIn && (profile?.role === 'student' || profile?.role === 'renter');
  const isOwner = signedIn && profile?.role === 'owner';

  useEffect(() => {
    if (visible) {
      setOpen(true);
      return;
    }
    setPane('root');
    setAskLogout(false);
    setReportBody('');
    setReportKind('safety');
  }, [visible]);

  useEffect(() => {
    if (pane !== 'report' || !signedIn || !profile) {
      if (pane !== 'report') setMyReports([]);
      return;
    }
    let alive = true;
    void loadMyReports(profile.id)
      .then((rows) => {
        if (alive) setMyReports(rows);
      })
      .catch(() => {
        if (alive) setMyReports([]);
      });
    return () => {
      alive = false;
    };
  }, [pane, signedIn, profile]);

  useEffect(() => {
    if (!open) return;
    progress.value = withTiming(visible ? 1 : 0, visible ? OPEN : CLOSE, (finished) => {
      if (finished && !visible) runOnJS(setOpen)(false);
    });
  }, [open, progress, visible]);

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

  const startX = sheetWidth;
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [startX, 0]) }],
  }));

  const goProfile = (tab?: ProfileTab) => {
    if (!signedIn || !profile) return;
    onClose();
    router.push(profileHref(profile.role, tab) as never);
  };

  const goBookings = () => {
    if (!signedIn || !profile) return;
    onClose();
    if (profile.role === 'owner') {
      router.push('/(owner)/(tabs)/bookings');
      return;
    }
    if (profile.role === 'student' || profile.role === 'renter') {
      router.push('/(student)/(tabs)/bookings');
    }
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

  const report = async (kind: 'tech' | 'safety', details?: string) => {
    const role = signedIn && profile ? t(`roles.${profile.role}`) : t('menu.guest');
    const vars = { role, version: VERSION };
    const subject = kind === 'safety' ? t('menu.reportSafetySubject') : t('menu.reportTechSubject');
    const template = kind === 'safety' ? t('menu.reportSafetyBody', vars) : t('menu.reportTechBody', vars);
    const note = (details ?? '').trim();
    const body = note ? `${template}\n${note}` : template;
    if (signedIn && profile) {
      if (note.length < 12) {
        alert(t('common.error'), t('profile.reportBodyShort'));
        return;
      }
      setSendingReport(true);
      try {
        await submitAppReport(profile.id, { kind, subject, body });
        setReportBody('');
        setMyReports(await loadMyReports(profile.id));
        alert(t('common.done'), t('profile.reportSent'));
      } catch (err) {
        alert(t('common.error'), err instanceof Error ? err.message : t('profile.reportFailed'));
        openUrl(kind === 'safety' ? mailTo(subject, body, TRUST_EMAIL) : mailTo(subject, body));
      } finally {
        setSendingReport(false);
      }
      return;
    }
    if (kind === 'safety') {
      openUrl(mailTo(subject, body, TRUST_EMAIL));
      return;
    }
    openUrl(mailTo(subject, body));
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
    onClose();
    void signOut();
  };

  const onEdgeBack = useCallback(() => {
    if (pane !== 'root') setPane('root');
    else onClose();
  }, [onClose, pane]);
  const edgeBack = useEdgeBack(open, onEdgeBack);

  const paneTitle =
    pane === 'faq'
      ? t('menu.faqTitle')
      : pane === 'report'
        ? t('menu.report')
        : pane === 'privacy'
          ? t('menu.privacy')
          : t('menu.terms');
  const paneBody =
    pane === 'privacy'
      ? t('menu.privacyBody', { email: SUPPORT_EMAIL })
      : t('menu.termsBody', { email: SUPPORT_EMAIL });

  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onEdgeBack}>
      <View style={styles.frame} {...edgeBack}>
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
              right: 0,
              borderTopLeftRadius: radius.xl,
              borderBottomLeftRadius: radius.xl,
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
                <View style={styles.logoWrap} accessibilityRole="image" accessibilityLabel={t('appName')}>
                  <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
                </View>
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
                {signedIn && profile ? (
                  <>
                    {isSeeker || isOwner ? (
                      <Text style={[styles.section, copy, { color: colors.textMuted, marginTop: 0 }]}>
                        {t('menu.you')}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => goProfile()}
                      accessibilityRole="button"
                      accessibilityLabel={t('menu.profile')}
                      style={({ pressed }) => [
                        styles.hero,
                        row,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      {profile.avatar_url ? (
                        <Image
                          source={{ uri: profile.avatar_url }}
                          style={styles.avatar}
                          contentFit="cover"
                          recyclingKey={profile.avatar_url}
                        />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.initials, { color: colors.white }]}>{initials(shownName)}</Text>
                        </View>
                      )}
                      <View style={styles.heroCopy}>
                        <Text style={[styles.heroName, copy, { color: colors.text }]} numberOfLines={2}>
                          {shownName}
                        </Text>
                        <Text style={[styles.heroRole, copy, { color: colors.primary }]}>{t(`roles.${profile.role}`)}</Text>
                        {profile.role === 'student' && university ? (
                          <Text style={[styles.heroMeta, copy, { color: colors.textMuted }]} numberOfLines={1}>
                            {university}
                          </Text>
                        ) : city ? (
                          <Text style={[styles.heroMeta, copy, { color: colors.textMuted }]} numberOfLines={1}>
                            {city}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
                    </Pressable>
                    {isOwner ? (
                      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MenuLink
                          icon="calendar-outline"
                          label={t('tabs.bookings')}
                          colors={colors}
                          copy={copy}
                          row={row}
                          isRtl={isRtl}
                          onPress={goBookings}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <MenuLink
                          icon="people-outline"
                          label={t('owner.occupantsTitle')}
                          colors={colors}
                          copy={copy}
                          row={row}
                          isRtl={isRtl}
                          onPress={() => goProfile('occupants')}
                        />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <MenuLink
                          icon="wallet-outline"
                          label={t('tabs.earnings')}
                          colors={colors}
                          copy={copy}
                          row={row}
                          isRtl={isRtl}
                          onPress={() => {
                            onClose();
                            router.push('/(owner)/(tabs)/earnings');
                          }}
                        />
                      </View>
                    ) : null}
                    {isOwner && profile.owner_status === 'pending' ? (
                      <Pressable
                        onPress={() => goProfile()}
                        accessibilityRole="button"
                        style={[
                          styles.verifyCard,
                          { backgroundColor: colors.warningSoft, borderColor: colors.warning },
                        ]}
                      >
                        <View style={[styles.row, row]}>
                          <RowIcon name="time-outline" colors={colors} />
                          <View style={styles.rowCopy}>
                            <Text style={[styles.rowLabel, copy, { color: colors.warning }]}>
                              {t('menu.ownerPending')}
                            </Text>
                            <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                              {t('menu.ownerPendingHint')}
                            </Text>
                          </View>
                          <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
                        </View>
                      </Pressable>
                    ) : null}
                    {isOwner && profile.owner_status === 'rejected' ? (
                      <Pressable
                        onPress={() => goProfile()}
                        accessibilityRole="button"
                        style={[
                          styles.verifyCard,
                          { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
                        ]}
                      >
                        <View style={[styles.row, row]}>
                          <RowIcon name="alert-circle" colors={colors} />
                          <View style={styles.rowCopy}>
                            <Text style={[styles.rowLabel, copy, { color: colors.danger }]}>
                              {t('menu.ownerSuspended')}
                            </Text>
                            <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                              {t('menu.ownerSuspendedHint')}
                            </Text>
                          </View>
                          <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
                        </View>
                      </Pressable>
                    ) : null}
                    {verification ? (
                      <Pressable
                        onPress={() => goProfile('trust')}
                        accessibilityRole="button"
                        accessibilityLabel={t('menu.verification')}
                        style={({ pressed }) => [
                          styles.verifyCard,
                          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                        ]}
                      >
                        <View style={[styles.row, row]}>
                          <RowIcon
                            name={
                              verification.verified
                                ? 'shield-checkmark'
                                : verification.rejected
                                  ? 'alert-circle'
                                  : 'shield-outline'
                            }
                            colors={colors}
                          />
                          <View style={styles.rowCopy}>
                            <Text style={[styles.rowLabel, copy, { color: colors.text }]}>
                              {verification.verified
                                ? t('menu.verified')
                                : verification.pendingReview
                                  ? t('menu.verifyReview')
                                  : verification.rejected
                                    ? t('menu.verifyRejected')
                                    : t('menu.verification')}
                            </Text>
                            {verification.verified ? null : (
                              <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                                {verification.pendingReview
                                  ? t('menu.verifyReviewHint')
                                  : verification.rejected
                                    ? t('menu.verifyRejectedHint')
                                    : t('menu.verificationHint')}
                              </Text>
                            )}
                          </View>
                          <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
                        </View>
                        {verification.verified ? null : (
                          <View style={[styles.chips, row]}>
                            {verification.items.map((item) => (
                              <View
                                key={item.id}
                                style={[
                                  styles.chip,
                                  {
                                    backgroundColor: item.done ? colors.successSoft : colors.surfaceMuted,
                                    borderColor: item.done ? colors.success : colors.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.chipText, { color: item.done ? colors.success : colors.textMuted }]}>
                                  {item.done ? t(`menu.verifyDone.${item.id}`) : t(`menu.verifyPending.${item.id}`)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <View style={[styles.guestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.guestName, copy, { color: colors.primaryDark }]}>{t('appName')}</Text>
                    <Text style={[styles.heroMeta, copy, { color: colors.textMuted }]}>{t('tagline')}</Text>
                    <Button
                      title={t('auth.login')}
                      compact
                      pill
                      onPress={() => {
                        onClose();
                        openLogin();
                      }}
                    />
                    <Button
                      title={t('auth.register')}
                      variant="secondary"
                      compact
                      pill
                      onPress={() => {
                        onClose();
                        openRegister();
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
                </View>

                <Text style={[styles.section, copy, { color: colors.textMuted }]}>{t('menu.help')}</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MenuLink icon="help-circle-outline" label={t('menu.faqTitle')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => setPane('faq')} />
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
                  <MenuLink icon="flag-outline" label={t('menu.report')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => setPane('report')} />
                </View>

                <Text style={[styles.section, copy, { color: colors.textMuted }]}>{t('menu.about')}</Text>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MenuLink icon="logo-instagram" label={`@${INSTAGRAM_HANDLE}`} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => openUrl(instagramUrl())} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink icon="shield-checkmark-outline" label={t('menu.privacy')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => setPane('privacy')} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MenuLink icon="document-text-outline" label={t('menu.terms')} colors={colors} copy={copy} row={row} isRtl={isRtl} onPress={() => setPane('terms')} />
                </View>
                <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                  {t('menu.version', { version: VERSION })}
                  {' · '}
                  {t('menu.copyright', { year: COPYRIGHT_YEAR })}
                </Text>
              </ScrollView>
              {pane !== 'root' ? (
                <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                  {pane === 'faq' ? (
                    <FaqList />
                  ) : pane === 'report' ? (
                    <View style={[styles.reportForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                        {reportKind === 'safety' ? t('menu.reportSafetyHint') : t('menu.reportTechHint')}
                      </Text>
                      <FilterPills<'tech' | 'safety'>
                        compact
                        value={reportKind}
                        onChange={setReportKind}
                        items={[
                          { value: 'safety', label: t('menu.reportSafety') },
                          { value: 'tech', label: t('menu.reportTech') },
                        ]}
                      />
                      <Text style={[styles.fieldLabel, copy, { color: colors.text }]}>{t('profile.reportDetails')}</Text>
                      <TextInput
                        value={reportBody}
                        onChangeText={setReportBody}
                        multiline
                        textAlignVertical="top"
                        placeholder={t('menu.reportPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        style={[
                          styles.reportInput,
                          copy,
                          {
                            color: colors.text,
                            backgroundColor: colors.surfaceMuted,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <Button
                        title={signedIn && profile ? t('profile.sendReport') : t('menu.contact')}
                        loading={sendingReport}
                        pill
                        onPress={() => void report(reportKind, reportBody)}
                      />
                      {signedIn ? (
                        myReports.length === 0 ? (
                          <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                            {t('profile.reportsEmpty')}
                          </Text>
                        ) : (
                          myReports.map((item) => (
                            <View
                              key={item.id}
                              style={[
                                styles.reportRow,
                                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                              ]}
                            >
                              <View style={[styles.reportHead, row]}>
                                <Text style={[styles.reportKind, copy, { color: colors.primary }]} numberOfLines={1}>
                                  {item.kind === 'safety' ? t('menu.reportSafety') : t('menu.reportTech')}
                                </Text>
                                <Text style={[styles.reportStatus, { color: colors.textMuted }]}>
                                  {reportStatusLabel(item.status, t)}
                                </Text>
                              </View>
                              <Text style={[styles.hint, copy, { color: colors.text }]} numberOfLines={3}>
                                {item.body}
                              </Text>
                              <Text style={[styles.hint, copy, { color: colors.textMuted }]}>
                                {new Date(item.created_at).toLocaleDateString(
                                  i18n.language.startsWith('ar') ? 'ar' : 'en',
                                )}
                              </Text>
                              {item.admin_note ? (
                                <Text style={[styles.hint, copy, { color: colors.text }]}>
                                  {t('profile.reportAdminNote')}: {item.admin_note}
                                </Text>
                              ) : null}
                            </View>
                          ))
                        )
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.article, copy, { color: colors.text }]}>{paneBody}</Text>
                  )}
                </ScrollView>
              ) : null}
            </View>
            {pane === 'root' ? (
              <View style={[styles.logoutBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                {signedIn && profile ? (
                  askLogout ? (
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
                  )
                ) : null}
                <View style={[styles.growth, row]}>
                  <Pressable onPress={() => void shareApp()} hitSlop={8}>
                    <Text style={[styles.growthText, { color: colors.textMuted }]}>{t('menu.share')}</Text>
                  </Pressable>
                  {rateUrl() ? (
                    <>
                      <Text style={[styles.growthDot, { color: colors.border }]}>·</Text>
                      <Pressable onPress={() => void rateApp()} hitSlop={8}>
                        <Text style={[styles.growthText, { color: colors.textMuted }]}>{t('menu.rate')}</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
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
      <Ionicons name={name} size={16} color={colors.primary} />
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
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
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
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 28, height: 28 },
  body: { padding: spacing.sm + 4, gap: spacing.sm, paddingBottom: 28 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  verifyCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 6,
  },
  chips: { flexWrap: 'wrap', gap: 5 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  reportForm: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  reportInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Cairo_400Regular',
  },
  reportRow: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 4,
  },
  reportHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reportKind: { flex: 1, minWidth: 0, fontSize: 12, fontFamily: 'Cairo_800ExtraBold' },
  reportStatus: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', flexShrink: 0 },
  growth: { justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 4 },
  growthText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  growthDot: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  avatar: { width: 40, height: 40, borderRadius: 14 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroCopy: { flex: 1, minWidth: 0, gap: 2 },
  heroName: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroRole: { fontSize: 11, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  heroMeta: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  heroLink: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginTop: 2 },
  guestCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 8,
  },
  aboutCard: {
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 8,
  },
  guestName: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  section: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_700Bold', marginTop: 2 },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  rowPressed: { opacity: 0.7 },
  appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  rowLabel: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 11, lineHeight: 15, fontFamily: 'Cairo_400Regular' },
  article: { fontSize: 14, lineHeight: 24, fontFamily: 'Cairo_400Regular' },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth },
  segment: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 3,
    padding: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 6,
  },
  segmentText: { fontSize: 11, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  logoutBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmBox: { gap: spacing.xs },
  confirmText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  confirmActions: { flexDirection: 'row', direction: 'ltr', gap: 8 },
  confirmBtn: { flex: 1 },
});
