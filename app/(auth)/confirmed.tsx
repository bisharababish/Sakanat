import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';

export default function EmailConfirmedScreen() {
  const { t } = useTranslation();

  return (
    <AuthScreen
      back
      center={false}
      footer={<Button title={t('auth.backToLogin')} onPress={() => router.replace('/(auth)/login')} pill />}
    >
      <AuthCard>
        <AuthHeading title={t('auth.emailConfirmedTitle')} hint={t('auth.emailConfirmedBody')} />
      </AuthCard>
    </AuthScreen>
  );
}
