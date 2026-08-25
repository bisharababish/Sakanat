import { BrandLoader } from '@/components/BrandLoader';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { colors, spacing } from '@/src/theme/colors';

export default function Gate() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();
  const { configured, loading, session, profile } = useAuth();

  if (!configured) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { textAlign }]}>{t('auth.setupTitle')}</Text>
        <Text style={[styles.body, { textAlign }]}>{t('auth.setupBody')}</Text>
      </View>
    );
  }

  if (loading || (session && !profile)) {
    return <BrandLoader />;
  }

  if (!session || !profile) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile.role === 'admin') return <Redirect href="/(admin)/(tabs)" />;
  if (profile.role === 'owner') return <Redirect href="/(owner)/(tabs)/listings" />;
  return <Redirect href="/(student)/(tabs)/search" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, color: colors.textMuted, lineHeight: 24 },
});
