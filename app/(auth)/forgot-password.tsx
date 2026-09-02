import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { authErrorMessage } from '@/src/lib/authErrors';
import { isValidEmail, sanitizeEmail } from '@/src/lib/eduEmail';
import { useColors } from '@/src/theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(cleanEmail);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      back
      center={false}
      footer={
        sent ? (
          <Button title={t('auth.backToLogin')} onPress={() => router.replace('/(auth)/login')} pill />
        ) : (
          <>
            <Button title={t('auth.sendReset')} onPress={() => void onSubmit()} loading={loading} pill />
            <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => router.replace('/(auth)/login')} pill />
          </>
        )
      }
    >
      <AuthCard>
        <AuthHeading title={t('auth.forgotTitle')} hint={sent ? t('auth.forgotSent') : t('auth.forgotHint')} />
        {sent ? null : (
          <Input
            label={t('common.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            ltr
            soft
          />
        )}
        {error ? <Text style={[styles.error, rtlText, { color: colors.danger }]}>{error}</Text> : null}
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
});
