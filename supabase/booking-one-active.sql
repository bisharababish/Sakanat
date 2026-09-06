-- One active stay per student/renter.
-- Run after booking-student-gates.sql (or alone if that file already ran).
--
-- Blocks a new booking while the seeker has:
--   - any pending request, or
--   - a confirmed stay that has not ended yet (start_date + months > today)
-- After the contract end date, they can book again (review gate still applies).
--
-- Exception: BOOKING_ACTIVE_STAY

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
