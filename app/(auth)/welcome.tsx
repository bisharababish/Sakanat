import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, spacing } from '@/src/theme/colors';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={[styles.brand, { textAlign }]}>{t('appName')}</Text>
        <Text style={[styles.tag, { textAlign }]}>{t('tagline')}</Text>
        <Text style={[styles.body, { textAlign }]}>{t('auth.welcomeBody')}</Text>
      </View>
      <Button title={t('auth.login')} onPress={() => router.push('/(auth)/login')} />
      <Button title={t('auth.register')} variant="secondary" onPress={() => router.push('/(auth)/register')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.sm },
  brand: { fontSize: 34, fontWeight: '800', color: colors.primary, lineHeight: 44 },
  tag: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textMuted, lineHeight: 24 },
});
