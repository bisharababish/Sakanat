import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { colors } from '@/src/theme/colors';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
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
    if (!email.trim() || !code.trim()) {
      setError(t('auth.missingFields'));
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(email, code);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError(t('auth.missingFields'));
      return;
    }
    setLoading(true);
    try {
      await resendConfirmation(email);
      setInfo(t('auth.codeSent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen back>
      <AuthBrand compact />
      <AuthCard>
        <Text style={[styles.title, rtlText]}>{t('auth.confirmTitle')}</Text>
        <Text style={[styles.body, rtlText]}>{t('auth.confirmBody')}</Text>
        <Input
          label={t('common.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          ltr
          soft
        />
        <Input
          label={t('auth.emailCode')}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
          ltr
          soft
        />
        {error ? <Text style={[styles.error, rtlText]}>{error}</Text> : null}
        {info ? <Text style={[styles.info, rtlText]}>{info}</Text> : null}
      </AuthCard>
      <Button title={t('auth.confirmCode')} onPress={onConfirm} loading={loading} pill />
      <Button title={t('auth.resendCode')} variant="secondary" onPress={onResend} loading={loading} pill />
      <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => router.replace('/(auth)/login')} pill />
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
  error: { color: colors.danger, fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  info: { color: colors.success, fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
});
