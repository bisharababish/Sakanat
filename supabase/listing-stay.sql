-- House rules + check-in notes so students know how to live there and how to arrive.
-- Run in the Supabase SQL editor (after listing-place.sql).

alter table public.apartments
  add column if not exists house_rules_ar text;

alter table public.apartments
  add column if not exists house_rules_en text;

alter table public.apartments
  add column if not exists check_in_notes_ar text;

alter table public.apartments
  add column if not exists check_in_notes_en text;

comment on column public.apartments.house_rules_ar is 'Quiet hours, guests, smoking, deposit — Arabic.';
comment on column public.apartments.house_rules_en is 'Quiet hours, guests, smoking, deposit — English.';
comment on column public.apartments.check_in_notes_ar is 'How to get the key / arrive — Arabic.';
comment on column public.apartments.check_in_notes_en is 'How to get the key / arrive — English.';
