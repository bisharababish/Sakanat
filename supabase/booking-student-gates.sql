-- Server-side student booking gates (mirrors app isStudentReady + pending review).
-- Run in Supabase SQL editor after student-trust.sql (and id-verification.sql for ID columns).
--
-- Stable exception messages (match in the app):
--   BOOKING_NEED_PROFILE
--   BOOKING_NEED_REVIEW
--   BOOKING_GENDER_MISMATCH
--   BOOKING_ACCOUNT_SUSPENDED
--   BOOKING_ACTIVE_STAY
-- Does NOT require id_verify_status = approved (uploads only), matching the client.

create or replace function public.is_valid_mobile_e164(raw text)
returns boolean
language sql
immutable
as $$
  select coalesce(raw, '') ~ '^\+9705[69][0-9]{7}$'
      or coalesce(raw, '') ~ '^\+9725[0-9]{8}$';
$$;

-- Palestinian / Israeli civil ID check digit (same as app nationalIdChecksumOk).
create or replace function public.national_id_checksum_ok(raw text)
returns boolean
language plpgsql
immutable
as $$
declare
  id text;
  i int;
  digit int;
  product int;
  total int := 0;
begin
  id := regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g');
  if char_length(id) > 9 then
    return false;
  end if;
  id := lpad(id, 9, '0');
  if id !~ '^[0-9]{9}$' or id = '000000000' then
    return false;
  end if;
  for i in 0..8 loop
    digit := substring(id from i + 1 for 1)::int;
    product := digit * ((i % 2) + 1);
    if product > 9 then
      product := product - 9;
    end if;
    total := total + product;
  end loop;
  return (total % 10) = 0;
end;
$$;

create or replace function public.student_profile_ready_for_booking(p public.profiles)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  student_id text;
begin
  if p.id is null then
    return false;
  end if;
  if p.role not in ('student', 'renter') then
    return false;
  end if;
  if coalesce(p.account_status, 'active') <> 'active' then
    return false;
  end if;
  if nullif(btrim(p.full_name), '') is null
     or nullif(btrim(p.full_name_en), '') is null
     or not public.is_valid_mobile_e164(p.phone)
     or not public.is_valid_mobile_e164(p.whatsapp)
     or p.gender is null
     or p.city_id is null
     or p.date_of_birth is null
     or nullif(btrim(p.avatar_url), '') is null
     or char_length(btrim(coalesce(p.home_address, ''))) < 8
     or coalesce(p.national_id_number, '') !~ '^[0-9]{9}$'
     or not public.national_id_checksum_ok(p.national_id_number)
     or nullif(btrim(p.national_id_url), '') is null
     or char_length(btrim(coalesce(p.emergency_name, ''))) < 2
     or not public.is_valid_mobile_e164(p.emergency_phone)
     or p.emergency_phone = p.phone
  then
    return false;
  end if;

  if p.role = 'renter' then
    return true;
  end if;

  student_id := btrim(coalesce(p.student_id_number, ''));
  return p.university_id is not null
    and char_length(student_id) between 8 and 10
    and nullif(btrim(p.major), '') is not null
    and nullif(btrim(p.degree_level), '') is not null
    and nullif(btrim(p.study_year), '') is not null
    and nullif(btrim(p.university_card_url), '') is not null;
end;
$$;

create or replace function public.student_has_pending_review(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.student_id = student
      and b.status in ('confirmed', 'completed')
      and (
        b.status = 'completed'
        or (b.start_date + make_interval(months => b.months))::date <= current_date
      )
      and not exists (
        select 1
        from public.apartment_reviews r
        where r.booking_id = b.id
      )
  );
$$;

create or replace function public.student_has_active_stay(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    where b.student_id = student
      and (
        b.status = 'pending'
        or (
          b.status = 'confirmed'
          and (b.start_date + make_interval(months => b.months))::date > current_date
        )
      )
  );
$$;

create or replace function public.enforce_student_booking_gates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seeker public.profiles;
  apt public.apartments;
begin
  select * into seeker from public.profiles where id = new.student_id;
  if seeker.id is null then
    raise exception 'BOOKING_NEED_PROFILE' using errcode = 'P0001';
  end if;

  if coalesce(seeker.account_status, 'active') <> 'active' then
    raise exception 'BOOKING_ACCOUNT_SUSPENDED' using errcode = 'P0001';
  end if;

  if not public.student_profile_ready_for_booking(seeker) then
    raise exception 'BOOKING_NEED_PROFILE' using errcode = 'P0001';
  end if;

  if public.student_has_pending_review(new.student_id) then
    raise exception 'BOOKING_NEED_REVIEW' using errcode = 'P0001';
  end if;

  if public.student_has_active_stay(new.student_id) then
    raise exception 'BOOKING_ACTIVE_STAY' using errcode = 'P0001';
  end if;

  select * into apt from public.apartments where id = new.apartment_id;
  if apt.id is null then
    raise exception 'Apartment not found' using errcode = 'P0001';
  end if;

  if apt.gender_policy is distinct from 'any'
     and seeker.gender is not null
     and apt.gender_policy is distinct from seeker.gender
  then
    raise exception 'BOOKING_GENDER_MISMATCH' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_student_booking_gates on public.bookings;
create trigger enforce_student_booking_gates
  before insert on public.bookings
  for each row execute function public.enforce_student_booking_gates();
