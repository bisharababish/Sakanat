-- Owner profile columns + listing readiness deps.
-- Run once in Supabase SQL editor (safe to re-run).
-- After this, also re-run owner-listing-gates.sql.

-- English name lives on profiles (gates + UI). Was previously auth metadata only.
alter table public.profiles
  add column if not exists full_name_en text;

-- Trust / ID (shared with students; needed for owner listing gates)
alter table public.profiles
  add column if not exists national_id_number text;

alter table public.profiles
  add column if not exists national_id_url text;

alter table public.profiles
  add column if not exists national_id_expires_at date;

alter table public.profiles
  add column if not exists id_docs_consent_at timestamptz;

alter table public.profiles
  add column if not exists id_verify_status text not null default 'none';

alter table public.profiles
  drop constraint if exists profiles_id_verify_status_check;

alter table public.profiles
  add constraint profiles_id_verify_status_check
  check (id_verify_status in ('none', 'pending', 'approved', 'rejected'));

alter table public.profiles
  add column if not exists id_verify_note text;

alter table public.profiles
  add column if not exists id_verified_at timestamptz;

alter table public.profiles
  add column if not exists emergency_name text;

alter table public.profiles
  add column if not exists emergency_phone text;

alter table public.profiles
  add column if not exists last_seen_ip text;

-- Privacy + listing notifications (owner settings)
alter table public.profiles
  add column if not exists phone_visibility text not null default 'booking';

alter table public.profiles
  drop constraint if exists profiles_phone_visibility_check;

alter table public.profiles
  add constraint profiles_phone_visibility_check
  check (phone_visibility in ('booking', 'confirmed', 'none'));

alter table public.profiles
  add column if not exists whatsapp_visibility text not null default 'booking';

alter table public.profiles
  drop constraint if exists profiles_whatsapp_visibility_check;

alter table public.profiles
  add constraint profiles_whatsapp_visibility_check
  check (whatsapp_visibility in ('booking', 'confirmed', 'none'));

alter table public.profiles
  add column if not exists hide_last_seen boolean not null default false;

alter table public.profiles
  add column if not exists share_emergency boolean not null default true;

alter table public.profiles
  add column if not exists notify_booking boolean not null default true;

alter table public.profiles
  add column if not exists notify_chat boolean not null default true;

alter table public.profiles
  add column if not exists notify_listing boolean not null default true;

alter table public.profiles
  add column if not exists notify_review boolean not null default true;

alter table public.profiles
  add column if not exists bio text;

alter table public.profiles
  add column if not exists spoken_languages text[] not null default '{}';

-- Backfill English name from auth metadata when the column is empty
update public.profiles p
set full_name_en = nullif(btrim(u.raw_user_meta_data->>'full_name_en'), '')
from auth.users u
where u.id = p.id
  and nullif(btrim(coalesce(p.full_name_en, '')), '') is null
  and nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name_en', '')), '') is not null;
