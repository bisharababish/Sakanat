import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { mailTo, SUPPORT_EMAIL } from '@/src/lib/support';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

const RESEND_COOLDOWN_SEC = 45;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { verifyEmail, resendConfirmation } = useAuth();
  const params = useLocalSearchParams<{ email?: string; reason?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(params.reason === 'exists' ? t('auth.confirmIfUnverified') : '');
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onConfirm = async () => {
    setError('');
    setInfo('');
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail || code.replace(/\s/g, '').length !== EMAIL_OTP_LENGTH) {
      setError(t('auth.missingFields'));
      return;
    }
    setConfirming(true);
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
      setConfirming(false);
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
    if (cooldown > 0) return;
    setResending(true);
    try {
      await resendConfirmation(cleanEmail);
      setInfo(t('auth.codeSent'));
      setCooldown(RESEND_COOLDOWN_SEC);
      setHelpOpen(true);
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setResending(false);
    }
  };

  const busy = confirming || resending;

  return (
    <AuthScreen
      back
      center={false}
      footer={
        <>
          <Button
            title={t('auth.confirmCode')}
            onPress={() => void onConfirm()}
            loading={confirming}
            disabled={busy}
            pill
          />
          <Button
            title={cooldown > 0 ? t('auth.resendWait', { seconds: cooldown }) : t('auth.resendCode')}
            variant="secondary"
            compact
            pill
            onPress={() => void onResend()}
            loading={resending}
            disabled={busy || cooldown > 0}
          />
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
        <Pressable onPress={() => setHelpOpen((open) => !open)} hitSlop={8}>
          <Text style={[styles.helpToggle, rtlText, { color: colors.primary }]}>
            {helpOpen ? t('auth.codeHelpHide') : t('auth.codeHelpTitle')}
          </Text>
        </Pressable>
        {helpOpen ? (
          <View style={[styles.helpBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.helpLine, rtlText, { color: colors.text }]}>{t('auth.codeHelp1')}</Text>
            <Text style={[styles.helpLine, rtlText, { color: colors.text }]}>{t('auth.codeHelp2')}</Text>
            <Text style={[styles.helpLine, rtlText, { color: colors.text }]}>{t('auth.codeHelp3')}</Text>
            <Pressable
              onPress={() =>
                void Linking.openURL(
                  mailTo(
                    t('auth.codeHelpMailSubject'),
                    t('auth.codeHelpMailBody', { email: sanitizeEmail(email) || email }),
                  ),
                )
              }
            >
              <Text style={[styles.helpMail, rtlText, { color: colors.primary }]}>
                {t('auth.codeHelpMail', { email: SUPPORT_EMAIL })}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </AuthCard>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  info: { fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  helpToggle: { fontSize: 14, fontFamily: 'Cairo_700Bold', marginTop: 4 },
  helpBox: {
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
  },
  helpLine: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  helpMail: { fontSize: 13, fontFamily: 'Cairo_700Bold', marginTop: 4 },
});
