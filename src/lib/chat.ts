import i18n from '@/src/i18n';
import { MESSAGE_MAX } from '@/src/lib/limits';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import type { Apartment, Conversation, Profile } from '@/src/types/database';

const CONVERSATION_SELECT =
  '*, apartments(id, title_ar, title_en, photos, building_name, floor, unit_number), student:profiles!student_id(id, full_name, avatar_url, role), owner:profiles!owner_id(id, full_name, avatar_url, role)';

export function personName(person?: Pick<Profile, 'full_name'> | null) {
  const name = (person?.full_name ?? '').trim();
  return name || '';
}

const PHOTO_MARKERS = new Set(['chat.photoMessage', '__photo__', 'Photo', 'صورة']);
const VOICE_MARKERS = new Set(['chat.voiceMessage', '__voice__', 'Voice message', 'رسالة صوتية']);

function looksLikeI18nKey(value: string) {
  return /^[a-z][a-zA-Z]+\.[a-zA-Z]+$/.test(value);
}

export function isPhotoPlaceholder(body?: string | null) {
  const value = (body ?? '').trim();
  if (!value) return true;
  if (PHOTO_MARKERS.has(value)) return true;
  return value === i18n.t('chat.photoMessage');
}

export function isVoicePlaceholder(body?: string | null) {
  const value = (body ?? '').trim();
  if (!value) return true;
  if (VOICE_MARKERS.has(value)) return true;
  return value === i18n.t('chat.voiceMessage');
}

/** Inbox / bubble preview: never show raw keys like chat.voiceMessage. */
export function conversationPreview(last?: string | null) {
  const value = (last ?? '').trim();
  if (!value) return '';
  if (isVoicePlaceholder(value)) return i18n.t('chat.voiceMessage');
  if (isPhotoPlaceholder(value)) return i18n.t('chat.photoMessage');
  if (looksLikeI18nKey(value)) {
    const translated = i18n.t(value);
    if (translated && translated !== value) return translated;
  }
  return value;
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
  const { isBlockedEitherWay } = await import('@/src/lib/blocks');
  if (await isBlockedEitherWay(studentId, apartment.owner_id)) {
    throw new Error(i18n.t('chat.blockedOpen'));
  }
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('id')
    .eq('apartment_id', apartment.id)
    .eq('student_id', studentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) {
    void import('@/src/lib/analytics').then(({ trackEvent }) =>
      trackEvent('chat_open', { apartmentId: apartment.id }, studentId),
    );
    return existing.id as string;
  }

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
  void import('@/src/lib/analytics').then(({ trackEvent }) =>
    trackEvent('chat_open', { apartmentId: apartment.id }, studentId),
  );
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
      '*, apartments(id, title_ar, title_en, photos, building_name, floor, unit_number), student:profiles!student_id(id, full_name, avatar_url, email, phone, role), owner:profiles!owner_id(id, full_name, avatar_url, email, phone)',
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

export async function deleteMessage(id: string) {
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) throw error;
}

export function isConversationMuted(conversation: Conversation, myId?: string | null) {
  if (!myId) return false;
  if (conversation.student_id === myId) return Boolean(conversation.student_muted);
  if (conversation.owner_id === myId) return Boolean(conversation.owner_muted);
  return false;
}

export function isConversationArchived(conversation: Conversation, myId?: string | null) {
  if (!myId) return false;
  if (conversation.student_id === myId) return Boolean(conversation.student_archived_at);
  if (conversation.owner_id === myId) return Boolean(conversation.owner_archived_at);
  return false;
}

export async function setConversationMuted(conversationId: string, asOwner: boolean, muted: boolean) {
  const column = asOwner ? 'owner_muted' : 'student_muted';
  const { error } = await supabase.from('conversations').update({ [column]: muted }).eq('id', conversationId);
  if (error) throw error;
}

export async function setConversationArchived(conversationId: string, asOwner: boolean, archived: boolean) {
  const column = asOwner ? 'owner_archived_at' : 'student_archived_at';
  const { error } = await supabase
    .from('conversations')
    .update({ [column]: archived ? new Date().toISOString() : null })
    .eq('id', conversationId);
  if (error) throw error;
}

export function conversationSearchHaystack(item: Conversation, lang: string) {
  const student = asPerson(item.student);
  const owner = asPerson(item.owner);
  return [
    personName(student),
    personName(owner),
    item.apartments?.title_ar,
    item.apartments?.title_en,
    item.apartments?.building_name,
    item.apartments?.unit_number,
    item.last_message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
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

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  imageUrl?: string | null,
  audioUrl?: string | null,
) {
  const trimmed = body.trim().slice(0, MESSAGE_MAX);
  const image = (imageUrl ?? '').trim() || null;
  const audio = (audioUrl ?? '').trim() || null;
  if (!trimmed && !image && !audio) return;
  const { assertRateLimit, RATE, rateLimitMessage } = await import('@/src/lib/rateLimit');
  if (!(await assertRateLimit(`message:${senderId}`, RATE.messageMs))) {
    throw new Error(rateLimitMessage('RATE_MESSAGE', (key) => i18n.t(key)));
  }
  const { data: convo } = await supabase
    .from('conversations')
    .select('student_id, owner_id')
    .eq('id', conversationId)
    .maybeSingle();
  const otherId = convo?.student_id === senderId ? convo?.owner_id : convo?.student_id;
  if (otherId) {
    const { isBlockedEitherWay } = await import('@/src/lib/blocks');
    if (await isBlockedEitherWay(senderId, otherId)) {
      throw new Error(i18n.t('chat.blockedSend'));
    }
  }
  const preview = trimmed || (image ? i18n.t('chat.photoMessage') : audio ? i18n.t('chat.voiceMessage') : '');
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: trimmed || (image ? '__photo__' : audio ? '__voice__' : ''),
    image_url: image,
    audio_url: audio,
  });
  if (error) {
    if (audio && /audio_url|column/i.test(error.message)) {
      throw new Error(i18n.t('chat.voiceNeedsSql'));
    }
    throw error;
  }
  const now = new Date().toISOString();
  const asOwner = convo?.owner_id === senderId;
  await supabase
    .from('conversations')
    .update({
      last_message: preview,
      last_message_at: now,
      ...(asOwner
        ? { owner_last_read_at: now, owner_delivered_at: now }
        : { student_last_read_at: now, student_delivered_at: now }),
    })
    .eq('id', conversationId);
  if (otherId) {
    const { data: flags } = await supabase
      .from('conversations')
      .select('student_id, owner_id, student_muted, owner_muted')
      .eq('id', conversationId)
      .maybeSingle();
    const mutedForOther =
      flags &&
      ((flags.student_id === otherId && flags.student_muted) ||
        (flags.owner_id === otherId && flags.owner_muted));
    if (!mutedForOther) {
      void notifyUser(otherId, i18n.t('push.newMessageTitle'), preview.slice(0, 90), 'chat', {
        conversationId,
      });
    }
  }
}
