import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { NoteModal } from '@/components/ui/NoteModal';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import {
  loadAdminReports,
  reportStatusLabel,
  updateAppReport,
  type AdminAppReport,
} from '@/src/lib/reports';
import { alert } from '@/src/lib/notice';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { AppReportStatus } from '@/src/types/database';

type Filter = 'active' | 'open' | 'reviewing' | 'closed' | 'all';

export default function AdminReports() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const [filter, setFilter] = useState<Filter>('active');
  const [reports, setReports] = useState<AdminAppReport[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closing, setClosing] = useState<AdminAppReport | null>(null);
  const [closeNote, setCloseNote] = useState('');

  const load = useCallback(async () => {
    try {
      const status = filter === 'all' ? undefined : filter === 'active' ? 'active' : filter;
      setReports(await loadAdminReports(status));
    } catch {
      setReports([]);
    }
  }, [filter]);

  const { refreshing, refresh } = useLiveReload(load, ['app_reports'], 'admin-reports');

  const setStatus = async (report: AdminAppReport, status: AppReportStatus, note?: string) => {
    setBusyId(report.id);
    try {
      await updateAppReport(report.id, { status, adminNote: note ?? report.admin_note });
      setClosing(null);
      setCloseNote('');
      await load();
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('admin.reportsUpdateFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('roles.admin')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.reportsTitle')}</Text>
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.reportsHint')}</Text>

      <FilterPills
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'active', label: t('admin.reportsActive') },
          { value: 'open', label: t('profile.reportOpen') },
          { value: 'reviewing', label: t('profile.reportReviewing') },
          { value: 'closed', label: t('profile.reportClosed') },
          { value: 'all', label: t('common.all') },
        ]}
      />

      {reports.length === 0 ? <EmptyState title={t('admin.reportsEmpty')} /> : null}

      {reports.map((report) => {
        const reporterName = report.reporter?.full_name || report.reporter?.email || '—';
        const targetName = report.target_user?.full_name || report.target_user?.email;
        const when = new Date(report.created_at).toLocaleString(i18n.language.startsWith('ar') ? 'ar' : 'en', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        return (
          <Card key={report.id} compact>
            <View style={[styles.head, row]}>
              <Text style={[styles.kind, rtlText, { color: colors.primary }]}>
                {report.kind === 'safety' ? t('menu.reportSafety') : t('menu.reportTech')}
              </Text>
              <Text
                style={[
                  styles.status,
                  {
                    color:
                      report.status === 'closed'
                        ? colors.textMuted
                        : report.status === 'reviewing'
                          ? colors.warning
                          : colors.danger,
                  },
                ]}
              >
                {reportStatusLabel(report.status, t)}
              </Text>
            </View>
            <Text style={[styles.subject, rtlText, { color: colors.text }]} numberOfLines={2}>
              {report.subject}
            </Text>
            <Text style={[styles.body, rtlText, { color: colors.text }]}>{report.body}</Text>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
              {t('admin.reportsFrom')}: {reporterName}
              {targetName ? ` · ${t('admin.reportsAbout')}: ${targetName}` : ''}
            </Text>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{when}</Text>
            {report.admin_note ? (
              <Text style={[styles.note, rtlText, { color: colors.textMuted }]}>
                {t('profile.reportAdminNote')}: {report.admin_note}
              </Text>
            ) : null}
            <View style={[styles.actions, row]}>
              {report.reporter_id ? (
                <Button
                  title={t('admin.openUser')}
                  variant="secondary"
                  pill
                  onPress={() =>
                    router.push({ pathname: '/(admin)/user/[id]', params: { id: report.reporter_id } })
                  }
                />
              ) : null}
              {report.target_user_id ? (
                <Button
                  title={t('admin.openTarget')}
                  variant="secondary"
                  pill
                  onPress={() =>
                    router.push({ pathname: '/(admin)/user/[id]', params: { id: report.target_user_id! } })
                  }
                />
              ) : null}
              {report.status === 'open' ? (
                <Button
                  title={t('admin.reportsMarkReviewing')}
                  pill
                  loading={busyId === report.id}
                  onPress={() => void setStatus(report, 'reviewing')}
                />
              ) : null}
              {report.status !== 'closed' ? (
                <Button
                  title={t('admin.reportsClose')}
                  variant="danger"
                  pill
                  loading={busyId === report.id}
                  onPress={() => {
                    setClosing(report);
                    setCloseNote(report.admin_note ?? '');
                  }}
                />
              ) : null}
              {report.status === 'closed' ? (
                <Button
                  title={t('admin.reportsReopen')}
                  variant="secondary"
                  pill
                  loading={busyId === report.id}
                  onPress={() => void setStatus(report, 'open')}
                />
              ) : null}
            </View>
          </Card>
        );
      })}

      <NoteModal
        visible={Boolean(closing)}
        title={t('admin.reportsClose')}
        label={t('profile.reportAdminNote')}
        hint={t('admin.reportsCloseHint')}
        value={closeNote}
        confirmTitle={t('admin.reportsClose')}
        loading={Boolean(closing && busyId === closing.id)}
        onChange={setCloseNote}
        onConfirm={() => {
          if (!closing) return;
          void setStatus(closing, 'closed', closeNote);
        }}
        onClose={() => {
          if (busyId) return;
          setClosing(null);
          setCloseNote('');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  title: { fontSize: 26, fontFamily: 'Cairo_800ExtraBold', marginBottom: 4 },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', marginBottom: spacing.sm },
  head: { justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  kind: { flex: 1, fontSize: 12, fontFamily: 'Cairo_700Bold' },
  status: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  subject: { fontSize: 15, fontFamily: 'Cairo_800ExtraBold', marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20, fontFamily: 'Cairo_400Regular', marginBottom: 6 },
  meta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  note: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', marginTop: 4 },
  actions: { flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
});
