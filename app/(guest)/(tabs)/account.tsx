import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { openWelcome } from '@/src/lib/guest';
import { useColors } from '@/src/theme/ThemeProvider';

export default function GuestAccount() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();

  return (
    <Screen>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('guest.accountTitle')}</Text>
      <Card>
        <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('guest.accountBody')}</Text>
      </Card>
      <Button title={t('auth.login')} onPress={openWelcome} pill />
      <Button title={t('auth.register')} variant="secondary" onPress={() => router.push('/(auth)/register')} pill />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  body: { fontSize: 15, lineHeight: 24, fontFamily: 'Cairo_400Regular' },
});
