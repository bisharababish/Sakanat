-- Product analytics events (lightweight). Run in SQL editor.

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_idx on public.app_events (created_at desc);
create index if not exists app_events_name_idx on public.app_events (name, created_at desc);
create index if not exists app_events_user_idx on public.app_events (user_id, created_at desc);

alter table public.app_events enable row level security;

drop policy if exists app_events_insert_own on public.app_events;
create policy app_events_insert_own on public.app_events
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists app_events_admin_read on public.app_events;
create policy app_events_admin_read on public.app_events
  for select to authenticated
  using (public.is_admin());

-- Abuse / rate helpers (optional SQL mirror of client limits).
create or replace function public.assert_report_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  select count(*) into recent
  from public.app_reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '60 seconds';
  if recent >= 2 then
    raise exception 'RATE_REPORT';
  end if;
  return new;
end;
$$;

drop trigger if exists app_reports_rate on public.app_reports;
create trigger app_reports_rate
  before insert on public.app_reports
  for each row execute function public.assert_report_rate();

create or replace function public.assert_message_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  select count(*) into recent
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '10 seconds';
  if recent >= 8 then
    raise exception 'RATE_MESSAGE';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_rate on public.messages;
create trigger messages_rate
  before insert on public.messages
  for each row execute function public.assert_message_rate();

create or replace function public.assert_booking_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  select count(*) into recent
  from public.bookings
  where student_id = new.student_id
    and created_at > now() - interval '30 seconds';
  if recent >= 1 then
    raise exception 'RATE_BOOKING';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_rate on public.bookings;
create trigger bookings_rate
  before insert on public.bookings
  for each row execute function public.assert_booking_rate();
