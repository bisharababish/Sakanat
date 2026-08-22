import { supabase } from '@/src/lib/supabase';
import type { Apartment } from '@/src/types/database';

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
}
