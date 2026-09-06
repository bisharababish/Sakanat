import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import { currentSessionKey, loadDeviceSessions } from '@/src/lib/devices';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { DeviceSession } from '@/src/types/database';

export function SessionSecurity({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [currentKey, setCurrentKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [rows, key] = await Promise.all([loadDeviceSessions(userId), currentSessionKey()]);
      setSessions(rows);
      setCurrentKey(key);
    } catch {
      setSessions([]);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
            if (currentKey) {
              await supabase
                .from('device_sessions')
                .delete()
                .eq('user_id', userId)
                .neq('session_key', currentKey);
            }
            alert(t('common.done'), t('profile.signOutOthersDone'));
            void reload();
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : t('profile.signOutOthersFailed'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const locale = i18n.language.startsWith('ar') ? 'ar' : 'en';

  return (
    <Card compact>
      <SectionHead compact icon="phone-portrait-outline" title={t('profile.devicesTitle')} />
      <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('profile.devicesIntro')}</Text>
      {sessions.length === 0 ? (
        <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('profile.devicesEmpty')}</Text>
      ) : (
        sessions.map((item) => {
          const current = currentKey != null && item.session_key === currentKey;
          return (
            <View
              key={item.id}
              style={[styles.row, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            >
              <Text style={[styles.label, rtlText, { color: colors.text }]}>
                {item.device_label}
                {current ? ` · ${t('profile.thisDevice')}` : ''}
              </Text>
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
                {t('profile.lastActive')}: {new Date(item.last_seen_at).toLocaleString(locale)}
              </Text>
              {item.last_ip ? (
                <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
                  {t('profile.deviceIp')}: {item.last_ip}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
      <Button title={t('profile.signOutOthers')} variant="secondary" onPress={signOutOthers} loading={busy} pill />
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular', marginBottom: spacing.xs },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 2,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  meta: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
});
