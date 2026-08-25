import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export default function EmailConfirmedScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();

  return (
    <AuthScreen back>
      <AuthBrand />
      <AuthCard>
        <Text style={[styles.title, rtlText]}>{t('auth.emailConfirmedTitle')}</Text>
        <Text style={[styles.body, rtlText]}>{t('auth.emailConfirmedBody')}</Text>
      </AuthCard>
      <Button title={t('auth.backToLogin')} onPress={() => router.replace('/(auth)/login')} pill />
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
  body: {
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 24,
    textAlign: 'center',
  },
});
