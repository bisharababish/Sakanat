import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { colors } from '@/src/theme/colors';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('auth.login')}</Text>
      <Input label={t('common.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Input label={t('common.password')} value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={[styles.error, { textAlign }]}>{error}</Text> : null}
      <Button title={t('auth.login')} onPress={onSubmit} loading={loading} />
      <Link href="/(auth)/register" style={[styles.link, { textAlign }]}>
        {t('auth.noAccount')} {t('auth.register')}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
  error: { color: colors.danger, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
