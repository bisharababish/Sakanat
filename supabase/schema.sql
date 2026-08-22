-- بدك سكن؟ اطلب منا
-- Run this entire file in the Supabase SQL editor (once).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ar text not null,
  name_en text not null,
  lat double precision not null,
  lng double precision not null
);

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ar text not null,
  name_en text not null,
  city_id uuid not null references public.cities(id) on delete restrict,
  lat double precision not null,
  lng double precision not null,
  email_domains text[] not null default '{}'
);

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  commission_percent numeric not null default 10,
  admin_email text not null default 'bishara@gmail.com',
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  role text not null check (role in ('student', 'owner', 'admin')),
  city_id uuid references public.cities(id),
  university_id uuid references public.universities(id),
  owner_status text not null default 'approved' check (owner_status in ('pending', 'approved', 'rejected')),
  language text not null default 'ar' check (language in ('ar', 'en')),
  created_at timestamptz not null default now()
);

create table if not exists public.apartments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  city_id uuid not null references public.cities(id),
  nearest_university_id uuid references public.universities(id),
  title_ar text not null,
  title_en text not null default '',
  description_ar text not null default '',
  description_en text not null default '',
  price_month numeric not null check (price_month > 0),
  rooms int not null default 1,
  bathrooms int not null default 1,
  area_m2 numeric,
  gender_policy text not null default 'any' check (gender_policy in ('any', 'female', 'male')),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  lat double precision not null,
  lng double precision not null,
  campus_distance_km numeric,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  months int not null default 1 check (months > 0),
  payment_method text not null check (payment_method in ('pay_now', 'pay_later')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  rent_amount numeric not null,
  commission_percent numeric not null,
  commission_amount numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  last_message text,
  last_message_at timestamptz not null default now(),
  unique (apartment_id, student_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

insert into public.app_settings (id, commission_percent, admin_email)
values (1, 10, 'bishara@gmail.com')
on conflict (id) do update set admin_email = excluded.admin_email;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  settings_admin text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'student');
  if meta_role not in ('student', 'owner', 'admin') then
    meta_role := 'student';
  end if;

  select admin_email into settings_admin from public.app_settings where id = 1;
  if lower(new.email) = lower(coalesce(settings_admin, 'bishara@gmail.com')) then
    meta_role := 'admin';
  end if;

  insert into public.profiles (
    id, email, full_name, phone, role, city_id, university_id, owner_status, language
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    meta_role,
    nullif(new.raw_user_meta_data->>'city_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'university_id', '')::uuid,
    case
      when meta_role = 'owner' then 'pending'
      else 'approved'
    end,
    coalesce(new.raw_user_meta_data->>'language', 'ar')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    if old.role = 'owner' and new.owner_status is distinct from old.owner_status then
      new.owner_status := old.owner_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.fill_booking_money()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  apt public.apartments;
  percent numeric;
begin
  select * into apt from public.apartments where id = new.apartment_id;
  if apt.id is null then
    raise exception 'Apartment not found';
  end if;
  select commission_percent into percent from public.app_settings where id = 1;
  new.owner_id := apt.owner_id;
  new.rent_amount := apt.price_month * new.months;
  new.commission_percent := coalesce(percent, 10);
  new.commission_amount := round(new.rent_amount * new.commission_percent / 100, 2);
  if new.payment_method = 'pay_now' then
    new.payment_status := 'paid';
  end if;
  return new;
end;
$$;

drop trigger if exists fill_booking_money on public.bookings;
create trigger fill_booking_money
  before insert on public.bookings
  for each row execute function public.fill_booking_money();

create or replace function public.protect_listing_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_listing_status on public.apartments;
create trigger protect_listing_status
  before insert or update on public.apartments
  for each row execute function public.protect_listing_status();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.cities enable row level security;
alter table public.universities enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.apartments enable row level security;
alter table public.bookings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists cities_read on public.cities;
create policy cities_read on public.cities for select using (true);

drop policy if exists universities_read on public.universities;
create policy universities_read on public.universities for select using (true);

drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated using (true);

drop policy if exists settings_admin_update on public.app_settings;
create policy settings_admin_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists apartments_read on public.apartments;
create policy apartments_read on public.apartments
  for select to authenticated
  using (status = 'approved' or owner_id = auth.uid() or public.is_admin());

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists apartments_update on public.apartments;
create policy apartments_update on public.apartments
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings
  for select to authenticated
  using (student_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings
  for update to authenticated
  using (student_id = auth.uid() or owner_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select to authenticated
  using (student_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (student_id = auth.uid() or owner_id = auth.uid());

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (student_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.student_id = auth.uid() or c.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.student_id = auth.uid() or c.owner_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('apartment-photos', 'apartment-photos', true)
on conflict (id) do nothing;

drop policy if exists apartment_photos_read on storage.objects;
create policy apartment_photos_read on storage.objects
  for select using (bucket_id = 'apartment-photos');

drop policy if exists apartment_photos_insert on storage.objects;
create policy apartment_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'apartment-photos');

drop policy if exists apartment_photos_update on storage.objects;
create policy apartment_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'apartment-photos');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.messages replica identity full;
alter table public.conversations replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

insert into public.cities (slug, name_ar, name_en, lat, lng) values
  ('hebron', 'الخليل', 'Hebron (al-Khalil)', 31.5326, 35.0998),
  ('nablus', 'نابلس', 'Nablus', 32.2211, 35.2544),
  ('ramallah', 'رام الله', 'Ramallah', 31.9038, 35.2034),
  ('albireh', 'البيرة', 'al-Bireh', 31.9074, 35.216),
  ('bethlehem', 'بيت لحم', 'Bethlehem (Beit Lahm)', 31.7054, 35.2024),
  ('jenin', 'جنين', 'Jenin', 32.4595, 35.3009),
  ('jericho', 'أريحا', 'Jericho (Ariha)', 31.8667, 35.45),
  ('tulkarm', 'طولكرم', 'Tulkarm', 32.3104, 35.0286),
  ('qalqilya', 'قلقيلية', 'Qalqilya', 32.1897, 34.9706),
  ('tubas', 'طوباس', 'Tubas', 32.321, 35.369),
  ('salfit', 'سلفيت', 'Salfit', 32.0837, 35.1808),
  ('jerusalem', 'القدس', 'East Jerusalem (al-Quds)', 31.7833, 35.2333),
  ('beitjala', 'بيت جالا', 'Beit Jala', 31.715, 35.187),
  ('beitsahour', 'بيت ساحور', 'Beit Sahour', 31.7, 35.226),
  ('dura', 'دورا', 'Dura', 31.5069, 35.0272),
  ('halhul', 'حلحول', 'Halhul', 31.58, 35.099),
  ('yatta', 'يطا', 'Yatta', 31.4447, 35.09),
  ('beitunia', 'بيتونيا', 'Beitunia', 31.888, 35.167),
  ('abudis', 'أبو ديس', 'Abu Dis', 31.7622, 35.2617),
  ('rawabi', 'روابي', 'Rawabi', 32.007, 35.186)
on conflict (slug) do nothing;

insert into public.universities (slug, name_ar, name_en, city_id, lat, lng, email_domains)
select v.slug, v.name_ar, v.name_en, c.id, v.lat, v.lng, v.email_domains
from (values
  ('birzeit', 'جامعة بيرزيت', 'Birzeit University', 'ramallah', 31.9585, 35.1816, array['birzeit.edu','stu.birzeit.edu','students.birzeit.edu']),
  ('najah', 'جامعة النجاح الوطنية', 'An-Najah National University', 'nablus', 32.227, 35.222, array['najah.edu','students.najah.edu','stu.najah.edu']),
  ('alquds', 'جامعة القدس', 'Al-Quds University', 'abudis', 31.759, 35.261, array['alquds.edu','students.alquds.edu']),
  ('aaup', 'الجامعة العربية الأمريكية', 'Arab American University', 'jenin', 32.461, 35.293, array['aaup.edu','student.aaup.edu']),
  ('bethlehem-uni', 'جامعة بيت لحم', 'Bethlehem University', 'bethlehem', 31.716, 35.206, array['bethlehem.edu']),
  ('hebron-uni', 'جامعة الخليل', 'Hebron University', 'hebron', 31.5326, 35.0998, array['hebron.edu','students.hebron.edu']),
  ('ppu', 'جامعة بوليتكنك فلسطين', 'Palestine Polytechnic University', 'hebron', 31.532, 35.093, array['ppu.edu','students.ppu.edu']),
  ('ptuk', 'جامعة فلسطين التقنية - خضوري', 'Palestine Technical University - Kadoorie', 'tulkarm', 32.311, 35.028, array['ptuk.edu.ps','stu.ptuk.edu.ps']),
  ('qou-ramallah', 'جامعة القدس المفتوحة - رام الله', 'Al-Quds Open University - Ramallah', 'ramallah', 31.9038, 35.2034, array['qou.edu','students.qou.edu']),
  ('qou-nablus', 'جامعة القدس المفتوحة - نابلس', 'Al-Quds Open University - Nablus', 'nablus', 32.2211, 35.2544, array['qou.edu','students.qou.edu']),
  ('qou-hebron', 'جامعة القدس المفتوحة - الخليل', 'Al-Quds Open University - Hebron', 'hebron', 31.5326, 35.0998, array['qou.edu','students.qou.edu']),
  ('qou-bethlehem', 'جامعة القدس المفتوحة - بيت لحم', 'Al-Quds Open University - Bethlehem', 'bethlehem', 31.7054, 35.2024, array['qou.edu','students.qou.edu']),
  ('qou-jenin', 'جامعة القدس المفتوحة - جنين', 'Al-Quds Open University - Jenin', 'jenin', 32.4595, 35.3009, array['qou.edu','students.qou.edu']),
  ('qou-tulkarm', 'جامعة القدس المفتوحة - طولكرم', 'Al-Quds Open University - Tulkarm', 'tulkarm', 32.3104, 35.0286, array['qou.edu','students.qou.edu']),
  ('istiqlal', 'جامعة الاستقلال', 'Al Istiqlal University', 'jericho', 31.866, 35.46, array['pass.ps','istiqlal.edu.ps']),
  ('dar-alkalima', 'جامعة دار الكلمة', 'Dar Al-Kalima University', 'bethlehem', 31.705, 35.204, array['daralkalima.edu.ps','student.daralkalima.edu.ps']),
  ('ahliya', 'جامعة فلسطين الأهلية', 'Palestine Ahliya University', 'bethlehem', 31.7056, 35.202, array['paluniv.edu.ps','students.paluniv.edu.ps']),
  ('zaytuna', 'جامعة الزيتونة للعلوم والتكنولوجيا', 'Al-Zaytuna University for Science and Technology', 'salfit', 32.085, 35.18, array['zaytuna.edu.ps','zaytona.edu.ps'])
) as v(slug, name_ar, name_en, city_slug, lat, lng, email_domains)
join public.cities c on c.slug = v.city_slug
on conflict (slug) do nothing;
