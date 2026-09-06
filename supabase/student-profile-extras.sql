-- Student profile extras: bio, lease/grad prefs, languages, ID expiry/consent,
-- recovery contacts, device sessions, user blocks.
-- Run after student-settings.sql + id-verification.sql.

alter table public.profiles
  add column if not exists bio text;

alter table public.profiles
  add column if not exists pref_lease_months integer;

alter table public.profiles
  add column if not exists graduation_term text;

alter table public.profiles
  add column if not exists spoken_languages text[] not null default '{}';

alter table public.profiles
  add column if not exists national_id_expires_at date;

alter table public.profiles
  add column if not exists id_docs_consent_at timestamptz;

alter table public.profiles
  add column if not exists recovery_email text;

alter table public.profiles
  add column if not exists recovery_phone text;

alter table public.profiles
  drop constraint if exists profiles_pref_lease_months_check;

alter table public.profiles
  add constraint profiles_pref_lease_months_check
  check (pref_lease_months is null or pref_lease_months in (1, 2, 3, 4, 6, 12));

alter table public.profiles
  drop constraint if exists profiles_bio_len_check;

alter table public.profiles
  add constraint profiles_bio_len_check
  check (bio is null or char_length(btrim(bio)) between 20 and 400);

-- App-tracked device heartbeats (Auth has no client listSessions yet).
create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_key text not null,
  device_label text not null,
  platform text,
  last_ip text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, session_key)
);

create index if not exists device_sessions_user_idx
  on public.device_sessions (user_id, last_seen_at desc);

alter table public.device_sessions enable row level security;

drop policy if exists device_sessions_read on public.device_sessions;
create policy device_sessions_read on public.device_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists device_sessions_upsert on public.device_sessions;
create policy device_sessions_upsert on public.device_sessions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists device_sessions_update on public.device_sessions;
create policy device_sessions_update on public.device_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists device_sessions_delete on public.device_sessions;
create policy device_sessions_delete on public.device_sessions
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_read on public.user_blocks;
create policy user_blocks_read on public.user_blocks
  for select to authenticated
  using (blocker_id = auth.uid() or public.is_admin());

drop policy if exists user_blocks_insert on public.user_blocks;
create policy user_blocks_insert on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists user_blocks_delete on public.user_blocks;
create policy user_blocks_delete on public.user_blocks
  for delete to authenticated
  using (blocker_id = auth.uid() or public.is_admin());
