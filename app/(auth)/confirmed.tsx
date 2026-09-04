import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/src/lib/auth';
import { homeHref } from '@/src/lib/routes';

export default function EmailConfirmedScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const continueOn = () => {
    if (profile) {
      router.replace(homeHref(profile.role) as never);
      return;
    }
    router.replace('/(auth)/login');
  };

  return (
    <AuthScreen
      back
      center={false}
      footer={
        <Button
          title={profile ? t('common.continue') : t('auth.backToLogin')}
          onPress={continueOn}
          pill
        />
      }
    >
      <AuthCard>
        <AuthHeading title={t('auth.emailConfirmedTitle')} hint={t('auth.emailConfirmedBody')} />
      </AuthCard>
    </AuthScreen>
  );
}
