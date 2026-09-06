-- Student settings: booking prefs, privacy, notification toggles, safety reports.
-- Run in Supabase SQL editor after id-verification.sql.

-- ---------------------------------------------------------------------------
-- Booking preferences
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists pref_budget_max numeric
    check (pref_budget_max is null or pref_budget_max > 0);

alter table public.profiles
  add column if not exists pref_gender_policy text
    check (pref_gender_policy is null or pref_gender_policy in ('any', 'female', 'male'));

alter table public.profiles
  add column if not exists pref_allows_smoking boolean;

alter table public.profiles
  add column if not exists pref_allows_pets boolean;

alter table public.profiles
  add column if not exists pref_move_in date;

alter table public.profiles
  add column if not exists pref_occupants int
    check (pref_occupants is null or pref_occupants between 1 and 4);

-- ---------------------------------------------------------------------------
-- Notification categories (master switch remains expo_push_token / client)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists notify_booking boolean not null default true;

alter table public.profiles
  add column if not exists notify_chat boolean not null default true;

alter table public.profiles
  add column if not exists notify_listing boolean not null default true;

alter table public.profiles
  add column if not exists notify_review boolean not null default true;

-- ---------------------------------------------------------------------------
-- Privacy
-- phone / whatsapp visibility for non-admins:
--   booking  = any booking with that owner (default)
--   confirmed = only when booking status is confirmed/completed
--   none     = never show to owners
-- ---------------------------------------------------------------------------
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
  add column if not exists hide_saved_count boolean not null default false;

alter table public.profiles
  add column if not exists share_emergency boolean not null default true;

-- ---------------------------------------------------------------------------
-- In-app reports (tech + safety) with history
-- ---------------------------------------------------------------------------
create table if not exists public.app_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('tech', 'safety')),
  subject text not null,
  body text not null,
  target_apartment_id uuid references public.apartments(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'closed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_reports_reporter_idx
  on public.app_reports (reporter_id, created_at desc);

create index if not exists app_reports_status_idx
  on public.app_reports (status, created_at desc)
  where status in ('open', 'reviewing');

alter table public.app_reports enable row level security;

drop policy if exists app_reports_read on public.app_reports;
create policy app_reports_read on public.app_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists app_reports_insert on public.app_reports;
create policy app_reports_insert on public.app_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists app_reports_admin_update on public.app_reports;
create policy app_reports_admin_update on public.app_reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
