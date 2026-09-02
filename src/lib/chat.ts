import i18n from '@/src/i18n';
import { MESSAGE_MAX } from '@/src/lib/limits';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import type { Apartment, Conversation, Profile } from '@/src/types/database';

const CONVERSATION_SELECT =
  '*, apartments(id, title_ar, title_en, photos), student:profiles!student_id(id, full_name, avatar_url, role), owner:profiles!owner_id(id, full_name, avatar_url)';

export function personName(person?: Pick<Profile, 'full_name'> | null) {
  const name = (person?.full_name ?? '').trim();
  return name || '';
}

function asPerson(value: unknown) {
  if (Array.isArray(value)) return (value[0] as Conversation['student']) ?? null;
  return (value as Conversation['student']) ?? null;
}

export function otherPerson(conversation: Conversation | null | undefined, myId?: string | null) {
  if (!conversation) return null;
  if (myId && conversation.owner_id === myId) return asPerson(conversation.student);
  return asPerson(conversation.owner);
}

export async function openConversation(apartment: Apartment, studentId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('id')
    .eq('apartment_id', apartment.id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      apartment_id: apartment.id,
      student_id: studentId,
      owner_id: apartment.owner_id,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function loadConversations(column: 'student_id' | 'owner_id', userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq(column, userId)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return (data as Conversation[]) ?? [];
}

export async function loadConversation(id: string) {
  const { data, error } = await supabase.from('conversations').select(CONVERSATION_SELECT).eq('id', id).single();
  if (error) throw error;
  return data as Conversation;
}

export function conversationParties(conversation: Conversation | null | undefined) {
  return {
    student: asPerson(conversation?.student),
    owner: asPerson(conversation?.owner),
  };
}

export async function loadAllConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      '*, apartments(id, title_ar, title_en, photos), student:profiles!student_id(id, full_name, avatar_url, email, phone, role), owner:profiles!owner_id(id, full_name, avatar_url, email, phone)',
    )
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return (data as Conversation[]) ?? [];
}

export async function conversationIdsMatchingMessage(query: string) {
  const needle = query.trim().replace(/[%_]/g, '');
  if (needle.length < 2) return [] as string[];
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id')
    .ilike('body', `%${needle}%`)
    .limit(200);
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.conversation_id as string))];
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw error;
}

export function lastReadAt(conversation: Conversation, myId?: string | null) {
  if (!myId) return null;
  if (conversation.student_id === myId) return conversation.student_last_read_at ?? null;
  if (conversation.owner_id === myId) return conversation.owner_last_read_at ?? null;
  return null;
}

export function isConversationUnread(conversation: Conversation, myId?: string | null) {
  if (!myId || !conversation.last_message) return false;
  const read = lastReadAt(conversation, myId);
  if (!read) return false;
  return new Date(conversation.last_message_at).getTime() > new Date(read).getTime() + 400;
}

function stampCovers(stamp: string | null | undefined, at: string) {
  if (!stamp) return false;
  return new Date(stamp).getTime() + 250 >= new Date(at).getTime();
}

export type MessageReceipt = 'pending' | 'sent' | 'delivered' | 'read';

export function messageReceipt(
  message: { id: string; created_at: string; sender_id: string },
  conversation: Conversation | null,
): MessageReceipt {
  if (message.id.startsWith('temp-')) return 'pending';
  if (!conversation) return 'sent';
  const fromStudent = message.sender_id === conversation.student_id;
  const delivered = fromStudent ? conversation.owner_delivered_at : conversation.student_delivered_at;
  const read = fromStudent ? conversation.owner_last_read_at : conversation.student_last_read_at;
  if (stampCovers(read, message.created_at)) return 'read';
  if (stampCovers(delivered, message.created_at)) return 'delivered';
  return 'sent';
}

function receiptColumns(asOwner: boolean) {
  return asOwner
    ? { read: 'owner_last_read_at', delivered: 'owner_delivered_at' }
    : { read: 'student_last_read_at', delivered: 'student_delivered_at' };
}

export async function markConversationDelivered(conversationId: string, asOwner: boolean) {
  const { delivered } = receiptColumns(asOwner);
  const { error } = await supabase
    .from('conversations')
    .update({ [delivered]: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) return;
}

export async function markConversationRead(conversationId: string, _userId: string, asOwner: boolean) {
  const now = new Date().toISOString();
  const { read, delivered } = receiptColumns(asOwner);
  const { error } = await supabase
    .from('conversations')
    .update({ [read]: now, [delivered]: now })
    .eq('id', conversationId);
  if (error) return;
}

export async function markInboxDelivered(items: Conversation[], asOwner: boolean) {
  const column = asOwner ? 'owner_delivered_at' : 'student_delivered_at';
  const now = new Date().toISOString();
  const stale = items.filter((item) => {
    const delivered = asOwner ? item.owner_delivered_at : item.student_delivered_at;
    if (!item.last_message) return false;
    return !delivered || new Date(item.last_message_at).getTime() > new Date(delivered).getTime();
  });
  if (stale.length === 0) return;
  await Promise.all(
    stale.map((item) =>
      supabase
        .from('conversations')
        .update({ [column]: now })
        .eq('id', item.id),
    ),
  );
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const trimmed = body.trim().slice(0, MESSAGE_MAX);
  if (!trimmed) return;
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: trimmed,
  });
  if (error) throw error;
  const now = new Date().toISOString();
  const { data: convo } = await supabase
    .from('conversations')
    .select('student_id, owner_id')
    .eq('id', conversationId)
    .maybeSingle();
  const asOwner = convo?.owner_id === senderId;
  await supabase
    .from('conversations')
    .update({
      last_message: trimmed,
      last_message_at: now,
      ...(asOwner
        ? { owner_last_read_at: now, owner_delivered_at: now }
        : { student_last_read_at: now, student_delivered_at: now }),
    })
    .eq('id', conversationId);
  const otherId = convo?.student_id === senderId ? convo.owner_id : convo?.student_id;
  if (otherId) {
    void notifyUser(otherId, i18n.t('push.newMessageTitle'), trimmed.slice(0, 90));
  }
}
