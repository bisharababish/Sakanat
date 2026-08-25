import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { authErrorMessage } from '@/src/lib/authErrors';
import { colors } from '@/src/theme/colors';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (!email.trim()) {
      setError(t('auth.missingFields'));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen back>
      <AuthBrand compact />
      <AuthCard>
        <Text style={[styles.title, rtlText]}>{t('auth.forgotTitle')}</Text>
        <Text style={[styles.hint, rtlText]}>{sent ? t('auth.forgotSent') : t('auth.forgotHint')}</Text>
        {sent ? null : (
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
        )}
        {error ? <Text style={[styles.error, rtlText]}>{error}</Text> : null}
      </AuthCard>
      {sent ? (
        <Button title={t('auth.backToLogin')} onPress={() => router.replace('/(auth)/login')} pill />
      ) : (
        <Button title={t('auth.sendReset')} onPress={onSubmit} loading={loading} pill />
      )}
      <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.footer}>
        <Text style={[styles.link, rtlText]}>{t('auth.backToLogin')}</Text>
      </Pressable>
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
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  error: { color: colors.danger, fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  footer: { alignItems: 'center', paddingVertical: 8 },
  link: { color: colors.primary, fontWeight: '800', fontFamily: 'Cairo_700Bold', textAlign: 'center' },
});
