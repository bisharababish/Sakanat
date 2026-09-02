import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHead } from '@/components/profile/SectionHead';
import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';

export function SessionSecurity() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const signOutOthers = () => {
    alert(t('profile.signOutOthersTitle'), t('profile.signOutOthersBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOutOthers'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const { error } = await supabase.auth.signOut({ scope: 'others' });
            if (error) throw error;
            alert(t('common.done'), t('profile.signOutOthersDone'));
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : t('profile.signOutOthersFailed'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Card>
      <SectionHead icon="phone-portrait-outline" title={t('profile.devicesTitle')} />
      <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('profile.signOutOthersHint')}</Text>
      <Button title={t('profile.signOutOthers')} variant="secondary" onPress={signOutOthers} loading={busy} pill />
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
});
