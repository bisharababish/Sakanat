import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { MfaSetup } from '@/components/auth/MfaSetup';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { useColors } from '@/src/theme/ThemeProvider';

export default function MfaEnrollScreen() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { completeMfaEnroll, signOut } = useAuth();

  return (
    <AuthScreen
      center={false}
      footer={<Button title={t('auth.backToLogin')} variant="ghost" onPress={() => void signOut()} pill />}
    >
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('mfa.adminTitle')}</Text>
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('mfa.adminRequired')}</Text>
      <MfaSetup required onEnabled={() => void completeMfaEnroll()} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 15, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
});
