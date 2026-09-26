import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TabPageHeader } from '@/components/ui/TabPageHeader';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { openLogin, openRegister } from '@/src/lib/guest';
import { spacing } from '@/src/theme/colors';

export default function GuestAccount() {
  const { t } = useTranslation();
  const { reload } = useCatalog();
  const load = useCallback(async () => {
    reload();
  }, [reload]);
  const { refreshing, refresh } = useLiveReload(load, ['cities', 'universities'], 'guest-account');

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <ProfileEnter scene="guest">
        <TabPageHeader kicker={t('appName')} title={t('guest.accountTitle')} hint={t('guest.accountBody')} />
        <View style={styles.actions}>
          <Button title={t('auth.login')} onPress={openLogin} pill />
          <Button title={t('auth.register')} variant="secondary" onPress={openRegister} pill />
        </View>
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
