import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { usePullRefresh } from '@/src/hooks/usePullRefresh';
import { loadAdminAuditLog } from '@/src/lib/audit';
import { useColors } from '@/src/theme/ThemeProvider';

type AuditRow = {
  id: string;
  action: string;
  target_user_id?: string | null;
  target_id?: string | null;
  note?: string | null;
  created_at: string;
  admin?: { full_name?: string | null; email?: string | null } | null;
};

export default function AdminAudit() {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [rows, setRows] = useState<AuditRow[]>([]);

  const load = useCallback(async () => {
    try {
      setRows((await loadAdminAuditLog()) as AuditRow[]);
    } catch {
      setRows([]);
    }
  }, []);

  const { refreshing, refresh } = usePullRefresh(load);

  return (
    <Screen back refreshing={refreshing} onRefresh={() => void refresh()}>
      <AdminPageHeader kicker={t('roles.admin')} title={t('admin.auditTitle')} hint={t('admin.auditHint')} />
      {rows.length === 0 ? <EmptyState title={t('admin.auditEmpty')} /> : null}
      {rows.map((item) => (
        <Card
          key={item.id}
          compact
          onPress={
            item.target_user_id
              ? () => router.push({ pathname: '/(admin)/user/[id]', params: { id: item.target_user_id! } })
              : undefined
          }
        >
          <Text style={[styles.action, rtlText, { color: colors.primary }]}>{item.action}</Text>
          <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
            {item.admin?.full_name || item.admin?.email || '—'} ·{' '}
            {new Date(item.created_at).toLocaleString(i18n.language.startsWith('ar') ? 'ar' : 'en', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Text>
          {item.note ? (
            <Text style={[styles.note, rtlText, { color: colors.text }]} numberOfLines={3}>
              {item.note}
            </Text>
          ) : null}
          {item.target_user_id || item.target_id ? (
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
              {[item.target_user_id, item.target_id].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { fontSize: 14, fontFamily: 'Cairo_800ExtraBold' },
  meta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  note: { fontSize: 13, fontFamily: 'Cairo_400Regular', marginTop: 2 },
});
