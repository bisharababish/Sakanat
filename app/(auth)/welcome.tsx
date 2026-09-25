import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthRubber } from '@/components/auth/AuthRubber';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

const LOGO_GREEN = '#1d4834';

const WHO = ['student', 'renter'] as const;
const POINTS: { icon: IconName; title: string; hint: string }[] = [
  { icon: 'search-outline', title: 'welcomePoint1', hint: 'welcomePoint1Hint' },
  { icon: 'chatbubbles-outline', title: 'welcomePoint2', hint: 'welcomePoint2Hint' },
  { icon: 'wallet-outline', title: 'welcomePoint3', hint: 'welcomePoint3Hint' },
];

const SPLIT = {
  duration: 780,
  easing: Easing.bezier(0.33, 1, 0.32, 1),
};

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const half = width / 2;
  /** Fit full wordmark with side breathing room — not edge-to-edge. */
  const logoWidth = Math.min(220, Math.round(width - 72));
  const canGoBack = router.canGoBack();
  const air = isRtl ? arAir : enAir;

  const skipIntro = canGoBack;
  const [doorsGone, setDoorsGone] = useState(skipIntro);
  const [locked, setLocked] = useState(false);
  const open = useSharedValue(skipIntro ? 1 : 0);
  const enter = useSharedValue(skipIntro ? 1 : 0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);
  const ctaLife = useSharedValue(0);

  useEffect(() => {
    if (skipIntro) return;
    enter.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    ctaLife.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [ctaLife, enter, float, pulse, skipIntro]);

  const finishSplit = () => setDoorsGone(true);

  const openWelcome = () => {
    if (skipIntro || locked || open.value > 0) return;
    setLocked(true);
    open.value = withTiming(1, SPLIT, (done) => {
      if (done) runOnJS(finishSplit)();
    });
  };

  const continueGuest = () => {
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace('/(guest)/(tabs)/search');
  };

  const leftDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(open.value, [0, 1], [0, -half - 12], Extrapolation.CLAMP) }],
  }));

  const rightDoorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(open.value, [0, 1], [0, half + 12], Extrapolation.CLAMP) }],
  }));

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.28], [1, 0], Extrapolation.CLAMP),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.45], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [18, 0], Extrapolation.CLAMP) + interpolate(float.value, [0, 1], [0, -8]) },
      { scale: interpolate(enter.value, [0, 1], [0.92, 1], Extrapolation.CLAMP) },
    ],
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.25, 0.7], [0, 1], Extrapolation.CLAMP) * interpolate(ctaLife.value, [0, 1], [0.72, 1]),
    transform: [{ translateY: interpolate(enter.value, [0.25, 1], [12, 0], Extrapolation.CLAMP) }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.35, 1], [0.28, 0.14, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.72, 1.35], Extrapolation.CLAMP) }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.5, 1], [0.18, 0.08, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.85, 1.55], Extrapolation.CLAMP) }],
  }));

  const ctaWrapStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.4, 0.9], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(enter.value, [0.4, 1], [16, 0], Extrapolation.CLAMP) },
      { scale: interpolate(ctaLife.value, [0, 1], [1, 1.03], Extrapolation.CLAMP) },
    ],
    shadowOpacity: interpolate(ctaLife.value, [0, 1], [0.12, 0.28], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.sheet} pointerEvents={doorsGone ? 'auto' : 'none'}>
        <AuthScreen
          back={canGoBack}
          center={false}
          scroll={false}
          language
          footer={
            <>
              <Button title={t('auth.login')} onPress={() => router.push('/(auth)/login')} pill compact />
              <Button
                title={t('auth.register')}
                variant="secondary"
                compact
                pill
                onPress={() => router.push('/(auth)/register')}
              />
              <Button title={t('auth.continueGuest')} variant="ghost" compact pill onPress={continueGuest} />
            </>
          }
        >
          <AuthRubber nudge={i18n.language} pan={doorsGone}>
            <AuthCard compact>
              <View style={[styles.main, air.main]}>
                <View style={[styles.brandBlock, air.brandBlock]}>
                  <Text style={[styles.brand, air.brand, isRtl && styles.brandAr, { color: colors.primaryDark }]}>
                    {t('appName')}
                  </Text>
                  <Text style={[styles.tag, air.tag, { color: colors.primary }]}>{t('tagline')}</Text>
                </View>
                <Text style={[styles.body, air.body, { color: colors.textMuted }]}>{t('auth.welcomeBody')}</Text>
                <View style={[styles.who, air.who]}>
                  {WHO.map((role) => (
                    <View
                      key={role}
                      style={[
                        styles.whoChip,
                        air.whoChip,
                        { backgroundColor: colors.primarySoft, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.whoText, { color: colors.primary }]}>{t(`roles.${role}`)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.note, air.note, { color: colors.textMuted }]}>{t('auth.ownersInvited')}</Text>
                <View style={[styles.points, air.points]}>
                  {POINTS.map((item) => (
                    <View key={item.title} style={[styles.point, air.point, row]}>
                      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                        <Ionicons name={item.icon} size={16} color={colors.primary} />
                      </View>
                      <View style={styles.pointCopy}>
                        <Text style={[styles.pointTitle, rtlText, { color: colors.text }]}>
                          {t(`auth.${item.title}`)}
                        </Text>
                        <Text style={[styles.pointHint, air.pointHint, rtlText, { color: colors.textMuted }]}>
                          {t(`auth.${item.hint}`)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Text
                  style={[styles.guestNote, air.guestNote, { color: colors.text, backgroundColor: colors.accentSoft }]}
                >
                  {t('auth.welcomeGuestNote')}
                </Text>
              </View>
            </AuthCard>
          </AuthRubber>
        </AuthScreen>
      </View>

      {!doorsGone ? (
        <View style={styles.doors} pointerEvents="box-none">
          <Animated.View style={[styles.door, { width: half, backgroundColor: LOGO_GREEN }, leftDoorStyle]} />
          <Animated.View style={[styles.door, { width: half, backgroundColor: LOGO_GREEN }, rightDoorStyle]} />

          <Animated.View
            pointerEvents={locked ? 'none' : 'auto'}
            style={[
              styles.stage,
              stageStyle,
              { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) + 28 },
            ]}
          >
            <View style={styles.brandBlockIntro}>
              <View style={styles.logoStage}>
                <Animated.View style={[styles.ring, ring2Style, { borderColor: 'rgba(244,247,245,0.22)' }]} />
                <Animated.View style={[styles.ring, ringStyle, { borderColor: 'rgba(244,247,245,0.35)' }]} />
                <Animated.View style={logoStyle}>
                  <BrandLogo width={logoWidth} />
                </Animated.View>
              </View>
              <Animated.Text style={[styles.stageHint, hintStyle]}>{t('auth.findPlaceHint')}</Animated.Text>
            </View>
            <Animated.View style={[styles.ctaWrap, ctaWrapStyle]}>
              <Pressable
                onPress={openWelcome}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: '#F4F7F5',
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={LOGO_GREEN} />
                <Text style={[styles.ctaLabel, { color: LOGO_GREEN }]}>{t('auth.findPlace')}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const enAir = StyleSheet.create({
  main: { gap: 12 },
  brandBlock: { gap: 8, paddingBottom: 4 },
  brand: { fontSize: 34, lineHeight: 40 },
  tag: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 13, lineHeight: 19 },
  who: { gap: 8 },
  whoChip: { paddingHorizontal: 11, paddingVertical: 5 },
  note: { fontSize: 11, lineHeight: 16 },
  points: { gap: 10 },
  point: { paddingVertical: 2, gap: 10 },
  pointHint: { fontSize: 11, lineHeight: 15 },
  guestNote: { fontSize: 11, lineHeight: 16, paddingVertical: 10 },
});

const arAir = StyleSheet.create({
  main: { gap: 11 },
  brandBlock: { gap: 8, paddingBottom: 4, paddingTop: 2 },
  brand: { fontSize: 32, lineHeight: 52 },
  tag: { fontSize: 13, lineHeight: 19 },
  body: { fontSize: 13, lineHeight: 20 },
  who: { gap: 8 },
  whoChip: { paddingHorizontal: 12, paddingVertical: 6 },
  note: { fontSize: 11, lineHeight: 17 },
  points: { gap: 10 },
  point: { paddingVertical: 2, gap: 10 },
  pointHint: { fontSize: 11, lineHeight: 16 },
  guestNote: { fontSize: 11, lineHeight: 17, paddingVertical: 11 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: { ...StyleSheet.absoluteFill },
  doors: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  door: {
    height: '100%',
    overflow: 'hidden',
  },
  stage: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: spacing.lg,
  },
  brandBlockIntro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStage: {
    width: 260,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  stageHint: {
    maxWidth: 260,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Cairo_400Regular',
    color: 'rgba(244,247,245,0.78)',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: 14,
  },
  ctaWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
  },
  cta: {
    alignSelf: 'stretch',
    minHeight: 52,
    borderRadius: radius.full,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaLabel: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
  },
  main: {},
  brandBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  brand: {
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    alignSelf: 'stretch',
    letterSpacing: -0.4,
    overflow: 'visible',
  },
  brandAr: {
    letterSpacing: 0,
    paddingTop: 6,
    paddingBottom: 4,
    includeFontPadding: true,
  },
  tag: {
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  body: {
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  who: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  whoChip: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  whoText: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  note: {
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  points: {},
  point: {
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  pointCopy: { flex: 1, minWidth: 0, gap: 2 },
  pointTitle: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  pointHint: { fontFamily: 'Cairo_400Regular' },
  guestNote: {
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    alignSelf: 'stretch',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
});
