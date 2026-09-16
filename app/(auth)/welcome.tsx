import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps, useMemo } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

const RUBBER = 56;

function rubberY(dy: number) {
  const sign = dy < 0 ? -1 : 1;
  return sign * RUBBER * (1 - Math.exp(-Math.abs(dy) / 90));
}

type IconName = ComponentProps<typeof Ionicons>['name'];

const POINTS: { icon: IconName; title: string; hint: string }[] = [
  { icon: 'search-outline', title: 'welcomePoint1', hint: 'welcomePoint1Hint' },
  { icon: 'chatbubbles-outline', title: 'welcomePoint2', hint: 'welcomePoint2Hint' },
  { icon: 'wallet-outline', title: 'welcomePoint3', hint: 'welcomePoint3Hint' },
];

const WHO = ['student', 'renter'] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const canGoBack = router.canGoBack();
  const pull = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          pull.value = rubberY(gesture.dy);
        },
        onPanResponderRelease: () => {
          pull.value = withSpring(0, { damping: 18, stiffness: 220 });
        },
        onPanResponderTerminate: () => {
          pull.value = withSpring(0, { damping: 18, stiffness: 220 });
        },
      }),
    [pull],
  );

  const continueGuest = () => {
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace('/(guest)/(tabs)/search');
  };

  return (
    <AuthScreen
      back={canGoBack}
      center={false}
      scroll={false}
      footer={
        <>
          <Button title={t('auth.login')} onPress={() => router.push('/(auth)/login')} pill />
          <Button title={t('auth.register')} variant="secondary" onPress={() => router.push('/(auth)/register')} pill />
          <Button title={t('auth.continueGuest')} variant="ghost" onPress={continueGuest} pill />
        </>
      }
    >
      <Animated.View collapsable={false} style={[styles.card, cardStyle]} {...pan.panHandlers}>
      <AuthCard compact>
        <View style={styles.logo}>
          <BrandLogo iconOnly size={48} />
        </View>
        <Text style={[styles.lead, rtlText, { color: colors.primaryDark }]}>{t('appNameLead')}</Text>
        <Text style={[styles.tail, rtlText, { color: colors.primary }]}>{t('appNameTail')}</Text>
        <Text style={[styles.tag, rtlText, { color: colors.textMuted }]}>{t('tagline')}</Text>
        <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('auth.welcomeBody')}</Text>
        <View style={styles.who}>
          {WHO.map((role) => (
            <View key={role} style={[styles.whoChip, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.whoText, { color: colors.primary }]}>{t(`roles.${role}`)}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.note, rtlText, { color: colors.textMuted }]}>{t('auth.ownersInvited')}</Text>
        <View style={styles.points}>
          {POINTS.map((item) => (
            <View key={item.title} style={[styles.point, row]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={item.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.pointCopy}>
                <Text style={[styles.pointTitle, rtlText, { color: colors.text }]}>{t(`auth.${item.title}`)}</Text>
                <Text style={[styles.pointHint, rtlText, { color: colors.textMuted }]}>{t(`auth.${item.hint}`)}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.note, rtlText, { color: colors.textMuted }]}>{t('auth.welcomeGuestNote')}</Text>
      </AuthCard>
      </Animated.View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  card: { flexShrink: 1 },
  logo: { alignItems: 'center' },
  lead: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    lineHeight: 30,
  },
  tail: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: -6,
  },
  tag: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  body: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  who: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  whoChip: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  whoText: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  points: { gap: 8 },
  point: { alignItems: 'flex-start', gap: 8 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  pointCopy: { flex: 1, minWidth: 0, gap: 1 },
  pointTitle: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  pointHint: { fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 16 },
  note: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 16,
    textAlign: 'center',
  },
});
