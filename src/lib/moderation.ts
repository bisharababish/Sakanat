import i18n from '@/src/i18n';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import type { Profile } from '@/src/types/database';

export function isSuspended(profile: Pick<Profile, 'account_status'> | null | undefined) {
  return profile?.account_status === 'suspended';
}

export async function setSuspended(
  user: Pick<Profile, 'id' | 'role'>,
  suspended: boolean,
) {
  const patch: Record<string, unknown> = {
    account_status: suspended ? 'suspended' : 'active',
  };
  if (suspended) patch.expo_push_token = null;
  if (user.role === 'owner') patch.owner_status = suspended ? 'rejected' : 'approved';

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;

  if (user.role !== 'owner') return;
  if (suspended) {
    await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', user.id);
    return;
  }
  await supabase.from('apartments').update({ status: 'pending' }).eq('owner_id', user.id).eq('status', 'rejected');
}

export async function deleteUserAccount(userId: string) {
  const { error } = await supabase.rpc('admin_delete_user', { target: userId });
  if (!error) return;
  const fallback = await supabase.from('profiles').delete().eq('id', userId);
  if (fallback.error) throw new Error(error.message || fallback.error.message);
}

export function notifyListingApproved(ownerId: string) {
  void notifyUser(ownerId, i18n.t('push.listingApprovedTitle'), i18n.t('push.listingApprovedBody'));
}
