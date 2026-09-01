-- Delivered + read receipts for chat ticks. Run once in the Supabase SQL editor.
-- Safe if chat-unread.sql already ran.

alter table public.conversations
  add column if not exists student_last_read_at timestamptz,
  add column if not exists owner_last_read_at timestamptz,
  add column if not exists student_delivered_at timestamptz,
  add column if not exists owner_delivered_at timestamptz;

update public.conversations
set
  student_last_read_at = coalesce(student_last_read_at, last_message_at),
  owner_last_read_at = coalesce(owner_last_read_at, last_message_at),
  student_delivered_at = coalesce(student_delivered_at, student_last_read_at, last_message_at),
  owner_delivered_at = coalesce(owner_delivered_at, owner_last_read_at, last_message_at);
