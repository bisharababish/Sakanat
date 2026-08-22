import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/src/theme/colors';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('appName'), headerShown: true }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t('common.error')}</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t('common.back')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  link: { marginTop: spacing.md },
  linkText: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
