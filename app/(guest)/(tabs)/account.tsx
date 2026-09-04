import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('guest.accountTitle')}</Text>
      <Card>
        <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('guest.accountBody')}</Text>
      </Card>
      <Button title={t('auth.login')} onPress={openLogin} pill />
      <Button title={t('auth.register')} variant="secondary" onPress={openRegister} pill />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  body: { fontSize: 15, lineHeight: 24, fontFamily: 'Cairo_400Regular' },
});
