import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/LanguageToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TabPageHeader } from '@/components/ui/TabPageHeader';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { openLogin, openRegister } from '@/src/lib/guest';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export default function GuestAccount() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { reload } = useCatalog();
  const load = useCallback(async () => {
    reload();
  }, [reload]);
  const { refreshing, refresh } = useLiveReload(load, ['cities', 'universities'], 'guest-account');

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <ProfileEnter scene="guest">
        <OfflineBanner />
        <TabPageHeader kicker={t('appName')} title={t('guest.accountTitle')} hint={t('guest.accountBody')} />
        <Card compact>
          <View style={[styles.langRow, row]}>
            <Text style={[styles.langLabel, rtlText, { color: colors.text }]}>{t('common.language')}</Text>
            <LanguageToggle />
          </View>
        </Card>
        <View style={styles.actions}>
          <Button title={t('auth.login')} onPress={openLogin} pill />
          <Button title={t('auth.register')} variant="secondary" onPress={openRegister} pill />
        </View>
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  langLabel: { flex: 1, fontSize: 14, fontFamily: 'Cairo_700Bold' },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
