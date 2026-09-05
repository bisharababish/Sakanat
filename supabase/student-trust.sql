-- Student trust fields + apartment reviews.
-- ID card photos: prefer private bucket via id-verification.sql
-- (id-docs/{userId}/national.jpg). Legacy public docs/ paths still resolve.

alter table public.profiles
  add column if not exists home_address text;

alter table public.profiles
  add column if not exists national_id_number text;

alter table public.profiles
  add column if not exists national_id_url text;

alter table public.profiles
  add column if not exists university_card_url text;

alter table public.profiles
  add column if not exists emergency_name text;

alter table public.profiles
  add column if not exists emergency_phone text;

alter table public.profiles
  add column if not exists last_seen_ip text;

alter table public.apartments
  add column if not exists review_avg numeric(3, 2);

alter table public.apartments
  add column if not exists review_count integer not null default 0;

create table if not exists public.apartment_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  note text not null,
  author_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists apartment_reviews_apartment_idx
  on public.apartment_reviews (apartment_id, created_at desc);

alter table public.apartment_reviews enable row level security;

drop policy if exists apartment_reviews_read on public.apartment_reviews;
create policy apartment_reviews_read on public.apartment_reviews
  for select using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.apartments a
      where a.id = apartment_id
        and (
          a.status = 'approved'
          or a.owner_id = auth.uid()
        )
    )
  );

drop policy if exists apartment_reviews_insert on public.apartment_reviews;
create policy apartment_reviews_insert on public.apartment_reviews
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.student_id = auth.uid()
        and b.apartment_id = apartment_id
        and b.status in ('confirmed', 'completed')
    )
  );

drop policy if exists apartment_reviews_update on public.apartment_reviews;
create policy apartment_reviews_update on public.apartment_reviews
  for update to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

create or replace function public.refresh_apartment_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  apt uuid;
begin
  apt := coalesce(new.apartment_id, old.apartment_id);
  update public.apartments
  set
    review_count = (select count(*)::integer from public.apartment_reviews r where r.apartment_id = apt),
    review_avg = (select round(avg(stars)::numeric, 2) from public.apartment_reviews r where r.apartment_id = apt)
  where id = apt;
  return null;
end;
$$;

drop trigger if exists apartment_reviews_stats on public.apartment_reviews;
create trigger apartment_reviews_stats
  after insert or update or delete on public.apartment_reviews
  for each row execute function public.refresh_apartment_review_stats();

alter table public.apartment_reviews replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'apartment_reviews'
  ) then
    alter publication supabase_realtime add table public.apartment_reviews;
  end if;
end;
$$;
