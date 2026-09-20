import { PERSON_CARD } from '@/src/lib/ownerPublic';
import { supabase } from '@/src/lib/supabase';
import type { UserBlock } from '@/src/types/database';

export async function loadMyBlocks(blockerId: string) {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_id, created_at, blocked:profiles!blocked_id(id, full_name, avatar_url, email, role)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = ((data ?? []) as unknown as UserBlock[]).map((row) => ({
    ...row,
    blocked: Array.isArray(row.blocked) ? row.blocked[0] ?? null : row.blocked,
  }));
  const missing = rows.filter((row) => !row.blocked).map((row) => row.blocked_id);
  if (missing.length) {
    const { data: cards } = await supabase.from('person_cards').select(PERSON_CARD).in('id', missing);
    const byId = new Map((cards ?? []).map((card) => [card.id as string, card]));
    return rows.map((row) => ({
      ...row,
      blocked: row.blocked ?? (byId.get(row.blocked_id) as UserBlock['blocked']) ?? null,
    }));
  }
  return rows;
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

export async function loadBlocksForUser(userId: string) {
  const { data, error } = await supabase
    .from('user_blocks')
    .select(
      'blocker_id, blocked_id, created_at, blocked:profiles!blocked_id(id, full_name, avatar_url, email, role), blocker:profiles!blocker_id(id, full_name, email, role)',
    )
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Array<{
    blocker_id: string;
    blocked_id: string;
    created_at: string;
    blocked?: { id: string; full_name: string; email: string; role: string } | null;
    blocker?: { id: string; full_name: string; email: string; role: string } | null;
  }>;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}
