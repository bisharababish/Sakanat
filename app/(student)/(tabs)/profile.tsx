import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { colors } from '@/src/theme/colors';

export default function StudentProfile() {
  const { t, i18n } = useTranslation();
  const { textAlign } = useLayout();
  const { profile, signOut } = useAuth();

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('profile.title')}</Text>
      <Card>
        <Text style={[styles.name, { textAlign }]}>{profile?.full_name}</Text>
        <Text style={[styles.meta, { textAlign }]}>{profile?.email}</Text>
        <Text style={[styles.meta, { textAlign }]}>
          {t('profile.role')}: {t(`roles.${profile?.role ?? 'student'}`)}
        </Text>
        {profile?.universities ? (
          <Text style={[styles.meta, { textAlign }]}>
            {t('profile.university')}: {localizedName(profile.universities, i18n.language)}
          </Text>
        ) : null}
      </Card>
      <LanguageToggle />
      <Button title={t('common.logout')} variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  meta: { color: colors.textMuted },
});
