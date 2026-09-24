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
      <AuthRubber>
        <AuthCard dense>
          <View style={styles.main}>
            <View style={styles.brandBlock}>
              <BrandLogo width={140} />
              <Text style={[styles.brand, { color: colors.primaryDark }]}>{t('appName')}</Text>
              <Text style={[styles.tag, { color: colors.textMuted }]}>{t('tagline')}</Text>
            </View>
            <Text style={[styles.body, { color: colors.textMuted }]}>{t('auth.welcomeBody')}</Text>
            <View style={styles.who}>
              {WHO.map((role) => (
                <View key={role} style={[styles.whoChip, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                  <Text style={[styles.whoText, { color: colors.primary }]}>{t(`roles.${role}`)}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.note, { color: colors.textMuted }]}>{t('auth.ownersInvited')}</Text>
            <View style={styles.points}>
              {POINTS.map((item) => (
                <View key={item.title} style={[styles.point, row, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
                    <Ionicons name={item.icon} size={15} color={colors.primary} />
                  </View>
                  <View style={styles.pointCopy}>
                    <Text style={[styles.pointTitle, rtlText, { color: colors.text }]}>{t(`auth.${item.title}`)}</Text>
                    <Text style={[styles.pointHint, rtlText, { color: colors.textMuted }]}>{t(`auth.${item.hint}`)}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={[styles.guestNote, { color: colors.text, backgroundColor: colors.accentSoft }]}>
              {t('auth.welcomeGuestNote')}
            </Text>
          </View>
        </AuthCard>
      </AuthRubber>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  main: { gap: 7 },
  brandBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 5,
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  tag: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 16,
  },
  body: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 17,
  },
  who: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  whoChip: {
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  whoText: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  note: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 15,
  },
  points: { gap: 5 },
  point: {
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  pointCopy: { flex: 1, minWidth: 0, gap: 1 },
  pointTitle: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  pointHint: { fontSize: 11, fontFamily: 'Cairo_400Regular', lineHeight: 15 },
  guestNote: {
    fontSize: 11,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 15,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
});
