import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { authErrorMessage } from '@/src/lib/authErrors';
import { sanitizeEmail } from '@/src/lib/eduEmail';
import { useColors } from '@/src/theme/ThemeProvider';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail || !password) {
      setError(t('auth.missingEmailOrPhone'));
      return;
    }
    setLoading(true);
    try {
      await signIn(cleanEmail, password);
    } catch (err) {
      const raw = `${(err as { code?: string })?.code ?? ''} ${err instanceof Error ? err.message : ''}`;
      if (/invalid login|invalid_credentials|invalid credentials/i.test(raw)) {
        setError(t('auth.invalidLogin'));
      } else {
        setError(authErrorMessage(err, t));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen back center={false}>
      <AuthCard>
        <AuthHeading title={t('auth.loginTitle')} hint={t('auth.loginHint')} />
        <Text style={[styles.who, rtlText, { color: colors.textMuted }]}>{t('auth.loginWho')}</Text>
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
        <Input label={t('common.password')} value={password} onChangeText={setPassword} secureTextEntry soft />
        {error ? <Text style={[styles.error, rtlText, { color: colors.danger }]}>{error}</Text> : null}
        <View style={[styles.lockRow, row]}>
          <Ionicons name="lock-closed" size={14} color={colors.primary} />
          <Text style={[styles.lock, { color: colors.textMuted }]}>{t('auth.secureNote')}</Text>
        </View>
      </AuthCard>
      <Button title={t('auth.login')} onPress={onSubmit} loading={loading} pill />
      <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.footer}>
        <Text style={[styles.link, rtlText, { color: colors.primary }]}>{t('auth.forgotPassword')}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/(auth)/register')} style={styles.footer}>
        <Text style={[styles.footerText, rtlText, { color: colors.textMuted }]}>
          {t('auth.noAccount')} <Text style={[styles.link, { color: colors.primary }]}>{t('auth.register')}</Text>
        </Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  who: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: -4,
  },
  error: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  lockRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  lock: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  footer: { alignItems: 'center', paddingVertical: 8 },
  footerText: { fontSize: 15, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  link: { fontWeight: '800', fontFamily: 'Cairo_700Bold' },
});
