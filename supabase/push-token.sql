-- Optional: store Expo push tokens so students get a ping when a booking is approved.
-- Run once in the Supabase SQL editor.

alter table public.profiles add column if not exists expo_push_token text;
