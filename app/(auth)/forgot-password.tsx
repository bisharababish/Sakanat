import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { AUTH_PACE, authPaceRemaining } from '@/src/lib/authThrottle';
import { authErrorMessage } from '@/src/lib/authErrors';
import { alert } from '@/src/lib/notice';
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
  const [wait, setWait] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      void authPaceRemaining('reset', AUTH_PACE.resetMs).then((left) => {
        if (alive) setWait(Math.ceil(left / 1000));
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const onSubmit = async () => {
    if (loading || wait > 0) return;
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
      alert(t('common.done'), t('auth.forgotSent'), [{ text: t('common.done') }]);
      setWait(Math.ceil(AUTH_PACE.resetMs / 1000));
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
        <>
          <Button
            title={wait > 0 ? t('auth.resetWait', { seconds: wait }) : t('auth.sendReset')}
            onPress={() => void onSubmit()}
            loading={loading}
            disabled={wait > 0}
            pill
          />
          <Button title={t('auth.backToLogin')} variant="ghost" compact pill onPress={() => router.replace('/(auth)/login')} />
        </>
      }
    >
      <AuthCard compact>
        <AuthHeading compact title={t('auth.forgotTitle')} hint={sent ? t('auth.forgotSent') : t('auth.forgotHint')} />
        {sent ? null : (
          <Input
            compact
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
