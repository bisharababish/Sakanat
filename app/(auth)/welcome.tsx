import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthRubber } from '@/components/auth/AuthRubber';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

const POINTS: { icon: IconName; title: string; hint: string }[] = [
  { icon: 'search-outline', title: 'welcomePoint1', hint: 'welcomePoint1Hint' },
  { icon: 'chatbubbles-outline', title: 'welcomePoint2', hint: 'welcomePoint2Hint' },
  { icon: 'wallet-outline', title: 'welcomePoint3', hint: 'welcomePoint3Hint' },
];

const WHO = ['student', 'renter'] as const;

export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  const canGoBack = router.canGoBack();
  const air = isRtl ? arAir : enAir;

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
      <AuthRubber nudge={i18n.language}>
        <AuthCard compact>
          <View style={[styles.main, air.main]}>
            <View style={[styles.brandBlock, air.brandBlock]}>
              <Text
                style={[styles.brand, air.brand, isRtl && styles.brandAr, { color: colors.primaryDark }]}
              >
                {t('appName')}
              </Text>
              <Text style={[styles.tag, air.tag, { color: colors.primary }]}>{t('tagline')}</Text>
            </View>
            <Text style={[styles.body, air.body, { color: colors.textMuted }]}>{t('auth.welcomeBody')}</Text>
            <View style={[styles.who, air.who]}>
              {WHO.map((role) => (
                <View
                  key={role}
                  style={[styles.whoChip, air.whoChip, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
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
                    <Text style={[styles.pointTitle, rtlText, { color: colors.text }]}>{t(`auth.${item.title}`)}</Text>
                    <Text style={[styles.pointHint, air.pointHint, rtlText, { color: colors.textMuted }]}>
                      {t(`auth.${item.hint}`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={[styles.guestNote, air.guestNote, { color: colors.text, backgroundColor: colors.accentSoft }]}>
              {t('auth.welcomeGuestNote')}
            </Text>
          </View>
        </AuthCard>
      </AuthRubber>
    </AuthScreen>
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
