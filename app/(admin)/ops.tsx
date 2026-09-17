import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { logAdminAction } from '@/src/lib/audit';
import { DEFAULT_COMMISSION_PERCENT } from '@/src/lib/commission';
import {
  exportListingsCsv,
  exportPlatformBookingsCsv,
  exportReportsCsv,
  exportReviewsCsv,
  exportUsersCsv,
} from '@/src/lib/dataExport';
import { alert } from '@/src/lib/notice';
import { broadcastPush } from '@/src/lib/push';
import { loadBookingOpsStatus, runBookingOpsNow } from '@/src/lib/searchAlerts';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export default function AdminOps() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const [percent, setPercent] = useState(String(DEFAULT_COMMISSION_PERCENT));
  const [adminEmail, setAdminEmail] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [opsRunning, setOpsRunning] = useState(false);
  const [opsStatus, setOpsStatus] = useState<{
    cronScheduled?: boolean;
    lastAt?: string | null;
    lastResult?: Record<string, number> | null;
  } | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastRoles, setBroadcastRoles] = useState<Array<'student' | 'renter' | 'owner'>>([
    'student',
    'renter',
    'owner',
  ]);

  const load = useCallback(async () => {
    const [{ data }, status] = await Promise.all([
      supabase.from('app_settings').select('commission_percent, admin_email').eq('id', 1).maybeSingle(),
      loadBookingOpsStatus().catch(() => null),
    ]);
    if (data?.commission_percent != null) setPercent(String(data.commission_percent));
    if (data?.admin_email) setAdminEmail(String(data.admin_email));
    setOpsStatus(status);
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['app_settings'], 'admin-ops');

  const saveCommission = async () => {
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      alert(t('common.error'), t('admin.invalidCommission'));
      return;
    }
    const email = adminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      alert(t('common.error'), t('auth.invalidEmail'));
      return;
    }
    setSavingCommission(true);
    const { error } = await supabase
      .from('app_settings')
      .update({
        commission_percent: value,
        admin_email: email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSavingCommission(false);
    if (error) alert(t('common.error'), error.message);
    else {
      setPercent(String(value));
      setAdminEmail(email);
      void logAdminAction('settings.update', { detail: { commission_percent: value, admin_email: email } });
      alert(t('common.done'));
    }
  };

  const runOps = async () => {
    setOpsRunning(true);
    try {
      const result = await runBookingOpsNow();
      void logAdminAction('ops.booking_run', { detail: result });
      const status = await loadBookingOpsStatus().catch(() => null);
      setOpsStatus(status);
      alert(
        t('common.done'),
        t('admin.opsDone', {
          reminded: result.reminded ?? 0,
          expired: result.expired ?? 0,
          completed: result.completed ?? 0,
          nudged: result.nudged ?? 0,
        }),
      );
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('admin.opsFailed'));
    } finally {
      setOpsRunning(false);
    }
  };

  const runExport = async (kind: 'bookings' | 'users' | 'listings' | 'reports' | 'reviews') => {
    setExporting(true);
    try {
      const count =
        kind === 'users'
          ? await exportUsersCsv()
          : kind === 'listings'
            ? await exportListingsCsv()
            : kind === 'reports'
              ? await exportReportsCsv()
              : kind === 'reviews'
                ? await exportReviewsCsv()
                : await exportPlatformBookingsCsv();
      void logAdminAction('export.platform', { detail: { kind, rows: count } });
      alert(t('common.done'), t('admin.exportDone', { count }));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setExporting(false);
    }
  };

  const sendBroadcast = async () => {
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title || body.length < 8) {
      alert(t('common.error'), t('admin.broadcastShort'));
      return;
    }
    if (broadcastRoles.length === 0) {
      alert(t('common.error'), t('admin.broadcastNeedRoles'));
      return;
    }
    alert(t('admin.broadcastTitle'), t('admin.broadcastConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.broadcastSend'),
        onPress: async () => {
          setBroadcasting(true);
          try {
            const result = await broadcastPush({ roles: broadcastRoles, title, body });
            void logAdminAction('broadcast', {
              note: title,
              detail: { roles: broadcastRoles, recipients: result.recipients },
            });
            setBroadcastTitle('');
            setBroadcastBody('');
            alert(t('common.done'), t('admin.broadcastSent', { count: result.recipients }));
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          } finally {
            setBroadcasting(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen back onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('admin.platformSettings')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.opsHubTitle')}</Text>

      <Card compact onPress={() => router.push('/(admin)/audit')}>
        <SectionHead compact icon="list-outline" title={t('admin.auditTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.auditHint')}</Text>
      </Card>

      <Card compact>
        <SectionHead compact icon="cash-outline" title={t('admin.platformSettings')} />
        <Input
          compact
          label={`${t('admin.commissionRate')} %`}
          value={percent}
          onChangeText={setPercent}
          keyboardType="numeric"
        />
        <Input
          compact
          label={t('admin.adminEmail')}
          value={adminEmail}
          onChangeText={setAdminEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          ltr
          hint={t('admin.adminEmailHint')}
        />
        <Button title={t('admin.saveSettings')} onPress={() => void saveCommission()} loading={savingCommission} pill />
      </Card>

      <Card compact>
        <SectionHead compact icon="timer-outline" title={t('admin.opsTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.opsHint')}</Text>
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
          {t('admin.opsCron', {
            status: opsStatus?.cronScheduled ? t('admin.opsCronOn') : t('admin.opsCronOff'),
          })}
        </Text>
        {opsStatus?.lastAt ? (
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
            {t('admin.opsLast', {
              at: new Date(opsStatus.lastAt).toLocaleString(i18n.language.startsWith('ar') ? 'ar' : 'en'),
            })}
          </Text>
        ) : null}
        <Button title={t('admin.opsRun')} pill loading={opsRunning} onPress={() => void runOps()} />
      </Card>

      <Card compact>
        <SectionHead compact icon="storefront-outline" title={t('admin.storeReadyTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.storeReadyHint')}</Text>
        {[
          t('admin.storeReadyPrivacy'),
          t('admin.storeReadyDelete'),
          t('admin.storeReadySupport'),
          t('admin.storeReadyShots'),
          t('admin.storeReadyPayments'),
        ].map((line) => (
          <View key={line} style={[styles.queueRow, row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.queueIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="checkmark" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.queueLabel, rtlText, { color: colors.text }]}>{line}</Text>
          </View>
        ))}
      </Card>

      <Card compact>
        <SectionHead compact icon="download-outline" title={t('admin.exportTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.exportHint')}</Text>
        <Button title={t('admin.exportBookingsCsv')} variant="secondary" pill loading={exporting} onPress={() => void runExport('bookings')} />
        <Button title={t('admin.exportUsersCsv')} variant="secondary" pill loading={exporting} onPress={() => void runExport('users')} />
        <Button title={t('admin.exportListingsCsv')} variant="secondary" pill loading={exporting} onPress={() => void runExport('listings')} />
        <Button title={t('admin.exportReportsCsv')} variant="secondary" pill loading={exporting} onPress={() => void runExport('reports')} />
        <Button title={t('admin.exportReviewsCsv')} variant="secondary" pill loading={exporting} onPress={() => void runExport('reviews')} />
      </Card>

      <Card compact>
        <SectionHead compact icon="megaphone-outline" title={t('admin.broadcastTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.broadcastHint')}</Text>
        <FilterPills
          compact
          values={broadcastRoles}
          onToggle={(role) =>
            setBroadcastRoles((current) =>
              current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
            )
          }
          items={[
            { value: 'student', label: t('roles.student') },
            { value: 'renter', label: t('roles.renter') },
            { value: 'owner', label: t('roles.owner') },
          ]}
        />
        <Input compact label={t('admin.broadcastSubject')} value={broadcastTitle} onChangeText={setBroadcastTitle} />
        <Input compact label={t('admin.broadcastBody')} value={broadcastBody} onChangeText={setBroadcastBody} multiline />
        <Button title={t('admin.broadcastSend')} pill loading={broadcasting} onPress={() => void sendBroadcast()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 19 },
  queueRow: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  queueIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueLabel: { flex: 1, fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
});
