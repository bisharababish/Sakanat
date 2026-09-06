-- Per-user mute + archive on conversations.
-- Run in Supabase SQL editor after chat-receipts.sql / chat-unread.sql.

alter table public.conversations
  add column if not exists student_muted boolean not null default false;

alter table public.conversations
  add column if not exists owner_muted boolean not null default false;

alter table public.conversations
  add column if not exists student_archived_at timestamptz;

alter table public.conversations
  add column if not exists owner_archived_at timestamptz;
