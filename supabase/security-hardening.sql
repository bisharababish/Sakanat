-- Lock booking updates, public owner cards, tighter profile reads, ID docs after confirm.

-- ---------------------------------------------------------------------------
-- Booking UPDATE: freeze money/identity; allow only real status / visa / extend
-- ---------------------------------------------------------------------------
create or replace function public.protect_booking_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  apt_price numeric;
begin
  if uid is null or public.is_admin() then
    return new;
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.student_id := old.student_id;
  new.owner_id := old.owner_id;
  new.apartment_id := old.apartment_id;
  new.payment_method := old.payment_method;
  new.occupants := old.occupants;
  new.start_date := old.start_date;
  new.commission_percent := old.commission_percent;

  if old.status in ('cancelled', 'completed') then
    raise exception 'BOOKING_FORBIDDEN' using errcode = 'P0001';
  end if;

  if new.months is distinct from old.months then
    if uid = old.owner_id
       and old.status = 'confirmed'
       and new.months > old.months
       and new.months <= least(36, old.months + 12)
    then
      select price_month into apt_price from public.apartments where id = old.apartment_id;
      if apt_price is null then
        raise exception 'BOOKING_FORBIDDEN' using errcode = 'P0001';
      end if;
      new.rent_amount := apt_price * new.months;
      new.commission_amount := round(new.rent_amount * new.commission_percent / 100 * new.occupants, 2);
    else
      raise exception 'BOOKING_FORBIDDEN' using errcode = 'P0001';
    end if;
  else
    new.rent_amount := old.rent_amount;
    new.commission_amount := old.commission_amount;
  end if;

  if new.payment_status is distinct from old.payment_status then
    if uid = old.student_id
       and old.payment_method in ('visa', 'pay_now')
       and old.payment_status = 'unpaid'
       and new.payment_status = 'paid'
       and old.status in ('pending', 'confirmed')
    then
      new.payment_status := 'paid';
    else
      raise exception 'BOOKING_FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  if new.status is distinct from old.status then
    if uid = old.student_id then
      if old.status in ('pending', 'confirmed') and new.status = 'cancelled' then
        if old.status = 'confirmed' and char_length(btrim(coalesce(new.cancel_reason, ''))) < 4 then
          raise exception 'BOOKING_CANCEL_REASON' using errcode = 'P0001';
        end if;
      else
        raise exception 'BOOKING_FORBIDDEN' using errcode = 'P0001';
      end if;
    elsif uid = old.owner_id then
      if old.status = 'pending' and new.status in ('confirmed', 'cancelled') then
        null;
      elsif old.status = 'confirmed' and new.status in ('cancelled', 'completed') then
        null;
      else
        raise exception 'BOOKING_FORBIDDEN' using errcode = 'P0001';
      end if;
    else
      raise exception 'BOOKING_FORBIDDEN' using errcode = 'P0001';
    end if;
    if new.status is distinct from 'cancelled' then
      new.cancel_reason := old.cancel_reason;
    end if;
  elsif new.cancel_reason is distinct from old.cancel_reason then
    new.cancel_reason := old.cancel_reason;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_booking_update on public.bookings;
create trigger protect_booking_update
  before update on public.bookings
  for each row execute function public.protect_booking_update();

-- Cash cannot insert as paid. Visa/pay_now still mark paid (simulated until real payments).
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
  new.occupants := greatest(1, least(4, coalesce(new.occupants, 1)));
  new.rent_amount := apt.price_month * new.months;
  new.commission_percent := coalesce(percent, 6);
  new.commission_amount := round(new.rent_amount * new.commission_percent / 100 * new.occupants, 2);
  if new.payment_method in ('pay_now', 'visa') then
    new.payment_status := 'paid';
  else
    new.payment_status := 'unpaid';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public owner card (no national ID, address, phone, IP)
-- ---------------------------------------------------------------------------
drop view if exists public.profile_cards;
create view public.profile_cards
with (security_invoker = false, security_barrier = true) as
select
  p.id,
  p.full_name,
  p.full_name_en,
  p.avatar_url,
  p.role,
  p.gender,
  p.date_of_birth,
  p.city_id,
  p.bio,
  p.spoken_languages,
  p.phone_visibility,
  p.whatsapp_visibility,
  p.id_verify_status
from public.profiles p
where p.role = 'owner';

grant select on public.profile_cards to anon, authenticated;

-- Listing browse: self, admin, booking/chat party. Not "any approved owner".
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.bookings b
      where (b.student_id = profiles.id and b.owner_id = auth.uid())
         or (b.owner_id = profiles.id and b.student_id = auth.uid())
    )
    or exists (
      select 1 from public.conversations c
      where (c.student_id = profiles.id and c.owner_id = auth.uid())
         or (c.owner_id = profiles.id and c.student_id = auth.uid())
    )
    or exists (
      select 1 from public.user_blocks ub
      where (ub.blocker_id = auth.uid() and ub.blocked_id = profiles.id)
         or (ub.blocked_id = auth.uid() and ub.blocker_id = profiles.id)
    )
  );

-- ID card files: self, admin, or owner of a confirmed/completed stay
drop policy if exists id_docs_read on storage.objects;
create policy id_docs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'id-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.bookings b
        where b.owner_id = auth.uid()
          and b.student_id::text = (storage.foldername(name))[1]
          and b.status in ('confirmed', 'completed')
      )
    )
  );
