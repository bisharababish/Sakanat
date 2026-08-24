import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { colors } from '@/src/theme/colors';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();
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
    <Screen back>
      <Text style={[styles.title, { textAlign }]}>{t('auth.confirmTitle')}</Text>
      <Text style={[styles.body, { textAlign }]}>{t('auth.confirmBody')}</Text>
      <Input
        label={t('common.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        ltr
      />
      <Input
        label={t('auth.emailCode')}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        ltr
      />
      {error ? <Text style={[styles.error, { textAlign }]}>{error}</Text> : null}
      {info ? <Text style={[styles.info, { textAlign }]}>{info}</Text> : null}
      <Button title={t('auth.confirmCode')} onPress={onConfirm} loading={loading} />
      <Button title={t('auth.resendCode')} variant="secondary" onPress={onResend} loading={loading} />
      <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => router.replace('/(auth)/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 24 },
  body: { fontSize: 16, color: colors.textMuted, lineHeight: 24 },
  error: { color: colors.danger, fontWeight: '600' },
  info: { color: colors.success, fontWeight: '600' },
});
