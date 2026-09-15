import { supabase } from '@/src/lib/supabase';

export type AdminAuditAction =
  | 'user.update'
  | 'user.suspend'
  | 'user.restore'
  | 'user.delete'
  | 'user.mfa_off'
  | 'id.verify'
  | 'listing.approve'
  | 'listing.reject'
  | 'listing.delete'
  | 'booking.update'
  | 'booking.delete'
  | 'review.delete'
  | 'message.delete'
  | 'report.update'
  | 'broadcast'
  | 'export.platform'
  | 'settings.update'
  | 'ops.booking_run';

export async function logAdminAction(
  action: AdminAuditAction,
  meta?: {
    targetUserId?: string | null;
    targetId?: string | null;
    note?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action,
      target_user_id: meta?.targetUserId ?? null,
      target_id: meta?.targetId ?? null,
      note: meta?.note ?? null,
      detail: meta?.detail ?? {},
    });
  } catch {
    // Audit is best-effort; never block the admin action.
  }
}

export async function loadAdminAuditLog(limit = 80) {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select(
      'id, action, target_user_id, target_id, note, detail, created_at, admin:profiles!admin_id(id, full_name, email)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
