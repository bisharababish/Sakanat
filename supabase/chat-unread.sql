-- Unread chat receipts. Run once in the Supabase SQL editor.

alter table public.conversations
  add column if not exists student_last_read_at timestamptz,
  add column if not exists owner_last_read_at timestamptz;

update public.conversations
set
  student_last_read_at = coalesce(student_last_read_at, last_message_at),
  owner_last_read_at = coalesce(owner_last_read_at, last_message_at);
