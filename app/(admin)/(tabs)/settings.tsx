import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';

export default function AdminSettings() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();
  const { signOut } = useAuth();
  const [percent, setPercent] = useState('10');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('app_settings')
        .select('commission_percent')
        .eq('id', 1)
        .single()
        .then(({ data }) => {
          if (data?.commission_percent != null) setPercent(String(data.commission_percent));
        });
    }, []),
  );

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ commission_percent: Number(percent), updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSaving(false);
    if (error) Alert.alert(t('common.error'), error.message);
    else Alert.alert(t('common.done'));
  };

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('tabs.settings')}</Text>
      <Input label={`${t('admin.commissionRate')} %`} value={percent} onChangeText={setPercent} keyboardType="numeric" />
      <Button title={t('admin.saveSettings')} onPress={save} loading={saving} />
      <LanguageToggle />
      <Button title={t('common.logout')} variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
});
