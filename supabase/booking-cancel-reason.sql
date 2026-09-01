-- Optional note when an owner rejects a booking. Run once in the Supabase SQL editor.

alter table public.bookings
  add column if not exists cancel_reason text;
