import i18n from '@/src/i18n';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import type { Apartment, Conversation, Profile } from '@/src/types/database';

const CONVERSATION_SELECT =
  '*, apartments(id, title_ar, title_en, photos), student:profiles!student_id(id, full_name, avatar_url), owner:profiles!owner_id(id, full_name, avatar_url)';

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
      '*, apartments(id, title_ar, title_en, photos), student:profiles!student_id(id, full_name, avatar_url, email, phone), owner:profiles!owner_id(id, full_name, avatar_url, email, phone)',
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

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: trimmed,
  });
  if (error) throw error;
  await supabase
    .from('conversations')
    .update({ last_message: trimmed, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
  const { data: convo } = await supabase
    .from('conversations')
    .select('student_id, owner_id')
    .eq('id', conversationId)
    .maybeSingle();
  const otherId = convo?.student_id === senderId ? convo.owner_id : convo?.student_id;
  if (otherId) {
    void notifyUser(otherId, i18n.t('push.newMessageTitle'), trimmed.slice(0, 90));
  }
}
