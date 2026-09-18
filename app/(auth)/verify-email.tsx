import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { CodeBoxes } from '@/components/ui/CodeBoxes';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { authErrorMessage } from '@/src/lib/authErrors';
import { sanitizeEmail } from '@/src/lib/eduEmail';
import { EMAIL_OTP_LENGTH } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { verifyEmail, resendConfirmation } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const onConfirm = async () => {
    setError('');
    setInfo('');
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail || code.replace(/\s/g, '').length !== EMAIL_OTP_LENGTH) {
      setError(t('auth.missingFields'));
      return;
    }
    setLoading(true);
    try {
      const profile = await verifyEmail(cleanEmail, code);
      if (!profile) {
        router.replace('/(auth)/login');
        return;
      }
      return;
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError('');
    setInfo('');
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) {
      setError(t('auth.missingFields'));
      return;
    }
    setLoading(true);
    try {
      await resendConfirmation(cleanEmail);
      setInfo(t('auth.codeSent'));
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
          <Button title={t('auth.confirmCode')} onPress={() => void onConfirm()} loading={loading} pill />
          <Button title={t('auth.resendCode')} variant="secondary" compact pill onPress={() => void onResend()} loading={loading} />
        </>
      }
    >
      <AuthCard compact>
        <AuthHeading compact title={t('auth.confirmTitle')} hint={t('auth.confirmBody')} />
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
        <CodeBoxes label={t('auth.emailCode')} value={code} onChangeText={setCode} length={EMAIL_OTP_LENGTH} />
        {error ? <Text style={[styles.error, rtlText, { color: colors.danger }]}>{error}</Text> : null}
        {info ? <Text style={[styles.info, rtlText, { color: colors.success }]}>{info}</Text> : null}
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  info: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
});
