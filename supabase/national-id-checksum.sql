-- Palestinian / Israeli national ID checksum (Luhn-style, 9 digits).
-- Run after booking-student-gates.sql (replaces student_profile_ready_for_booking).

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
