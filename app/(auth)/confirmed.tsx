import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export default function EmailConfirmedScreen() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();

  return (
    <Screen back>
      <Text style={[styles.title, { textAlign }]}>{t('auth.emailConfirmedTitle')}</Text>
      <Text style={[styles.body, { textAlign }]}>{t('auth.emailConfirmedBody')}</Text>
      <Button title={t('auth.backToLogin')} onPress={() => router.replace('/(auth)/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 24 },
  body: { fontSize: 16, color: colors.textMuted, lineHeight: 24 },
});
