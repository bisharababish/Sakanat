import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();

  return (
    <AuthScreen>
      <AuthBrand />
      <AuthCard>
        <Text style={[styles.title, rtlText]}>{t('auth.welcome')}</Text>
        <Text style={[styles.tag, rtlText]}>{t('tagline')}</Text>
        <Text style={[styles.body, rtlText]}>{t('auth.welcomeBody')}</Text>
      </AuthCard>
      <Button title={t('auth.login')} onPress={() => router.push('/(auth)/login')} pill />
      <Button title={t('auth.register')} variant="secondary" onPress={() => router.push('/(auth)/register')} pill />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.text,
    textAlign: 'center',
  },
  tag: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
    color: colors.primary,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 24,
    textAlign: 'center',
  },
});
