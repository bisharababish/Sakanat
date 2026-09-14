import { supabase } from '@/src/lib/supabase';
import type { AppReport, AppReportKind, AppReportStatus } from '@/src/types/database';

export type ReportDraft = {
  kind: AppReportKind;
  subject: string;
  body: string;
  targetApartmentId?: string | null;
  targetUserId?: string | null;
};

export type AdminAppReport = AppReport & {
  reporter_id: string;
  target_user_id?: string | null;
  target_apartment_id?: string | null;
  reporter?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
  target_user?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
};

export async function submitAppReport(reporterId: string, draft: ReportDraft) {
  const { assertRateLimit, RATE, rateLimitMessage } = await import('@/src/lib/rateLimit');
  const { trackEvent } = await import('@/src/lib/analytics');
  if (!(await assertRateLimit(`report:${reporterId}`, RATE.reportMs))) {
    const { default: i18n } = await import('@/src/i18n');
    throw new Error(rateLimitMessage('RATE_REPORT', (key) => i18n.t(key)));
  }
  const { data, error } = await supabase
    .from('app_reports')
    .insert({
      reporter_id: reporterId,
      kind: draft.kind,
      subject: draft.subject.trim(),
      body: draft.body.trim(),
      target_apartment_id: draft.targetApartmentId ?? null,
      target_user_id: draft.targetUserId ?? null,
      status: 'open' as AppReportStatus,
    })
    .select('id, kind, subject, body, status, admin_note, created_at, updated_at')
    .single();
  if (error) throw error;
  void trackEvent('report_submit', { kind: draft.kind }, reporterId);
  return data as AppReport;
}

export async function loadMyReports(reporterId: string) {
  const { data, error } = await supabase
    .from('app_reports')
    .select('id, kind, subject, body, status, admin_note, created_at, updated_at')
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as AppReport[];
}

export async function loadAdminReports(status?: AppReportStatus | 'active') {
  let query = supabase
    .from('app_reports')
    .select(
      `
      id, kind, subject, body, status, admin_note, created_at, updated_at,
      reporter_id, target_user_id, target_apartment_id,
      reporter:profiles!reporter_id ( id, full_name, email, role ),
      target_user:profiles!target_user_id ( id, full_name, email, role )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(80);

  if (status === 'active') {
    query = query.in('status', ['open', 'reviewing']);
  } else if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AdminAppReport[];
}

export async function updateAppReport(
  reportId: string,
  patch: { status: AppReportStatus; adminNote?: string | null },
) {
  const { error } = await supabase
    .from('app_reports')
    .update({
      status: patch.status,
      admin_note: patch.adminNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  if (error) throw error;
}

export function reportStatusLabel(status: AppReportStatus, t: (key: string) => string) {
  if (status === 'reviewing') return t('profile.reportReviewing');
  if (status === 'closed') return t('profile.reportClosed');
  return t('profile.reportOpen');
}
