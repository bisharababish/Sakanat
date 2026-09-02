import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
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

const WHO = ['student', 'renter', 'owner'] as const;

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
      footer={
        <>
          <Button title={t('auth.login')} onPress={() => router.push('/(auth)/login')} pill />
          <Button title={t('auth.register')} variant="secondary" onPress={() => router.push('/(auth)/register')} pill />
          <Button title={t('auth.continueGuest')} variant="ghost" onPress={continueGuest} pill />
        </>
      }
    >
      <AuthCard compact>
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('auth.welcome')}</Text>
        <Text style={[styles.lead, rtlText, { color: colors.primaryDark }]}>{t('appNameLead')}</Text>
        <Text style={[styles.tail, rtlText, { color: colors.primary }]}>{t('appNameTail')}</Text>
        <Text style={[styles.tag, rtlText, { color: colors.textMuted }]}>{t('tagline')}</Text>
        <View style={styles.who}>
          {WHO.map((role) => (
            <View key={role} style={[styles.whoChip, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.whoText, { color: colors.primary }]}>{t(`roles.${role}`)}</Text>
            </View>
          ))}
        </View>
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
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
  },
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
    marginTop: -4,
  },
  tag: {
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
  points: { gap: spacing.sm },
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
  pointHint: { fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 18 },
  note: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 18,
    textAlign: 'center',
  },
});
