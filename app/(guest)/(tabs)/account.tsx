import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppBrandFooter } from '@/components/brand/AppBrandFooter';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { openLogin, openRegister } from '@/src/lib/guest';
import { useColors } from '@/src/theme/ThemeProvider';

export default function GuestAccount() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { reload } = useCatalog();
  const load = useCallback(async () => {
    reload();
  }, [reload]);
  const { refreshing, refresh } = useLiveReload(load, ['cities', 'universities'], 'guest-account');

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <ProfileEnter scene="guest">
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('guest.accountTitle')}</Text>
        <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('guest.accountBody')}</Text>
        <ProfileMenu
          links={[
            {
              key: 'login',
              icon: 'log-in-outline',
              label: t('auth.login'),
              onPress: openLogin,
            },
            {
              key: 'register',
              icon: 'person-add-outline',
              label: t('auth.register'),
              onPress: openRegister,
            },
          ]}
        />
        <AppBrandFooter />
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  body: { fontSize: 15, lineHeight: 24, fontFamily: 'Cairo_400Regular' },
});
