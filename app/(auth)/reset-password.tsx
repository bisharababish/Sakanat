import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PasswordChecks } from '@/components/auth/PasswordChecks';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { authErrorMessage } from '@/src/lib/authErrors';
import { isPasswordValid } from '@/src/lib/password';
import { alert } from '@/src/lib/notice';
import { useColors } from '@/src/theme/ThemeProvider';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
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
    if (!isPasswordValid(password, confirm)) {
      setError(t('auth.weakPassword'));
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      alert(t('common.done'), t('profile.passwordChanged'));
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      center={false}
      footer={<Button title={t('auth.savePassword')} onPress={() => void onSubmit()} loading={loading} pill />}
    >
      <AuthCard>
        <AuthHeading title={t('auth.resetTitle')} hint={t('auth.resetHint')} />
        <Input label={t('profile.newPassword')} value={password} onChangeText={setPassword} secureTextEntry soft />
        <Input label={t('profile.confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry soft />
        <PasswordChecks password={password} confirm={confirm} />
        {error ? <Text style={[styles.error, rtlText, { color: colors.danger }]}>{error}</Text> : null}
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
});
