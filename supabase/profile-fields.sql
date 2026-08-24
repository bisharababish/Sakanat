-- Run this in the Supabase SQL Editor so student profiles can save extra fields.

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  add column if not exists date_of_birth date;

alter table public.profiles
  add column if not exists student_id_number text;

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('female', 'male'));

alter table public.profiles
  add column if not exists whatsapp text;

alter table public.profiles
  add column if not exists study_year text;

alter table public.profiles
  add column if not exists major text;

alter table public.profiles
  add column if not exists degree_level text;

create table if not exists public.saved_apartments (
  student_id uuid not null references public.profiles(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, apartment_id)
);

alter table public.saved_apartments enable row level security;

drop policy if exists saved_apartments_read on public.saved_apartments;
create policy saved_apartments_read on public.saved_apartments
  for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists saved_apartments_insert on public.saved_apartments;
create policy saved_apartments_insert on public.saved_apartments
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists saved_apartments_delete on public.saved_apartments;
create policy saved_apartments_delete on public.saved_apartments
  for delete to authenticated
  using (student_id = auth.uid());
