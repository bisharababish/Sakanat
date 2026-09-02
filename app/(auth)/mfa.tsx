import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { CodeBoxes } from '@/components/ui/CodeBoxes';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { authErrorMessage } from '@/src/lib/authErrors';
import { verifiedTotpFactor } from '@/src/lib/mfa';
import { alert } from '@/src/lib/notice';
import { mailTo, supportWhatsAppUrl } from '@/src/lib/support';
import { useColors } from '@/src/theme/ThemeProvider';

export default function MfaChallengeScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { completeMfa, session, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void verifiedTotpFactor()
      .then((factor) => setFactorId(factor?.id ?? ''))
      .catch(() => setFactorId(''));
  }, []);

  const email = session?.user?.email ?? '';

  const onSubmit = async () => {
    setError('');
    if (!factorId || code.replace(/\s/g, '').length < 6) {
      setError(t('mfa.codeHint'));
      return;
    }
    setLoading(true);
    try {
      await completeMfa(factorId, code);
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const lostAuthenticator = () => {
    alert(t('mfa.lostTitle'), t('mfa.lostExplain'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('menu.contact'),
        onPress: () => {
          void Linking.openURL(mailTo(t('mfa.lostSubject'), t('mfa.lostEmailBody', { email })));
        },
      },
      {
        text: t('menu.whatsapp'),
        onPress: () => {
          const url = supportWhatsAppUrl(t('mfa.lostWhatsApp', { email }));
          if (url) {
            void Linking.openURL(url);
            return;
          }
          void Linking.openURL(mailTo(t('mfa.lostSubject'), t('mfa.lostEmailBody', { email })));
        },
      },
    ]);
  };

  return (
    <AuthScreen
      footer={
        <>
          <Button title={t('mfa.confirm')} onPress={() => void onSubmit()} loading={loading} pill />
          <Button title={t('mfa.lost')} variant="ghost" onPress={lostAuthenticator} pill />
          <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => void signOut()} pill />
        </>
      }
    >
      <AuthBrand compact />
      <AuthCard>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('mfa.loginTitle')}</Text>
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('mfa.loginHint')}</Text>
        <CodeBoxes label={t('mfa.code')} value={code} onChangeText={setCode} />
        {error ? <Text style={[styles.error, rtlText, { color: colors.danger }]}>{error}</Text> : null}
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: -4,
  },
  error: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
});
