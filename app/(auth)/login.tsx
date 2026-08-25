import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { colors } from '@/src/theme/colors';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
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
    <AuthScreen back>
      <AuthBrand />
      <AuthCard>
        <Text style={[styles.title, rtlText]}>{t('auth.loginTitle')}</Text>
        <Text style={[styles.hint, rtlText]}>{t('auth.loginHint')}</Text>
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
        {error ? <Text style={[styles.error, rtlText]}>{error}</Text> : null}
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={14} color={colors.primary} />
          <Text style={styles.lock}>{t('auth.secureNote')}</Text>
        </View>
      </AuthCard>
      <Button title={t('auth.login')} onPress={onSubmit} loading={loading} pill />
      <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.footer}>
        <Text style={[styles.link, rtlText]}>{t('auth.forgotPassword')}</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/(auth)/register')} style={styles.footer}>
        <Text style={[styles.footerText, rtlText]}>
          {t('auth.noAccount')} <Text style={styles.link}>{t('auth.register')}</Text>
        </Text>
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
    marginTop: -4,
  },
  error: { color: colors.danger, fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  lock: { color: colors.textMuted, fontSize: 12, fontFamily: 'Cairo_400Regular' },
  footer: { alignItems: 'center', paddingVertical: 8 },
  footerText: { color: colors.textMuted, fontSize: 15, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
});
