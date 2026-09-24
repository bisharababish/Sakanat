import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
          <Button title={t('auth.login')} onPress={() => router.push('/(auth)/login')} pill />
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
      <AuthRubber>
        <AuthCard compact>
          <View style={styles.main}>
            <View style={[styles.logoPlate, { backgroundColor: colors.primarySoft }]}>
              <BrandLogo iconOnly size={56} />
            </View>
            <Text style={[styles.brand, { color: colors.primaryDark }]}>{t('appNameMark')}</Text>
            <Text style={[styles.tag, rtlText, { color: colors.textMuted }]}>{t('tagline')}</Text>
            <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('auth.welcomeBody')}</Text>
            <View style={styles.who}>
              {WHO.map((role) => (
                <View key={role} style={[styles.whoChip, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                  <Text style={[styles.whoText, { color: colors.primary }]}>{t(`roles.${role}`)}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.note, rtlText, { color: colors.textMuted }]}>{t('auth.ownersInvited')}</Text>
            <View style={styles.points}>
              {POINTS.map((item) => (
                <View key={item.title} style={[styles.point, row, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
                    <Ionicons name={item.icon} size={16} color={colors.primary} />
                  </View>
                  <View style={styles.pointCopy}>
                    <Text style={[styles.pointTitle, rtlText, { color: colors.text }]}>{t(`auth.${item.title}`)}</Text>
                    <Text style={[styles.pointHint, rtlText, { color: colors.textMuted }]}>{t(`auth.${item.hint}`)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <Text style={[styles.guestNote, rtlText, { color: colors.text, backgroundColor: colors.accentSoft }]}>
            {t('auth.welcomeGuestNote')}
          </Text>
        </AuthCard>
      </AuthRubber>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  main: { gap: 10, flexShrink: 1, overflow: 'hidden' },
  logoPlate: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.4,
    alignSelf: 'center',
  },
  tag: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    lineHeight: 18,
  },
  body: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
  who: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  whoChip: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  whoText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  note: { fontSize: 11, fontFamily: 'Cairo_400Regular', textAlign: 'center', lineHeight: 16 },
  points: { gap: 6 },
  point: {
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCopy: { flex: 1, minWidth: 0, gap: 1 },
  pointTitle: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  pointHint: { fontSize: 11, fontFamily: 'Cairo_400Regular', lineHeight: 15 },
  guestNote: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    lineHeight: 17,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
  },
});
