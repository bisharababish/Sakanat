import { supabase } from '@/src/lib/supabase';
import type { UserBlock } from '@/src/types/database';

export async function loadMyBlocks(blockerId: string) {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id, created_at, blocked:profiles!blocked_id(id, full_name, avatar_url, email, role)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as UserBlock[]).map((row) => ({
    ...row,
    blocked: Array.isArray(row.blocked) ? row.blocked[0] ?? null : row.blocked,
  }));
}

export async function isBlockedEitherWay(a: string, b: string) {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id')
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
    )
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error('Cannot block yourself');
  const { error } = await supabase.from('user_blocks').upsert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}
