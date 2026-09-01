-- Admin reject-reason on listings. Run once in the Supabase SQL editor.

alter table public.apartments
  add column if not exists reject_reason text;
