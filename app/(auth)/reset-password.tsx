import { router } from 'expo-router';
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

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (!password || !confirm) {
      setError(t('auth.missingFields'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.weakPassword'));
      return;
    }
    if (password !== confirm) {
      setError(t('profile.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen>
      <AuthBrand compact />
      <AuthCard>
        <Text style={[styles.title, rtlText]}>{t('auth.resetTitle')}</Text>
        <Text style={[styles.hint, rtlText]}>{t('auth.resetHint')}</Text>
        <Input label={t('profile.newPassword')} value={password} onChangeText={setPassword} secureTextEntry soft />
        <Input label={t('profile.confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry soft />
        {error ? <Text style={[styles.error, rtlText]}>{error}</Text> : null}
      </AuthCard>
      <Button title={t('auth.savePassword')} onPress={onSubmit} loading={loading} pill />
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
});
