-- Bookings allow 1–4 people. Do not cap by room count.
-- Run once in the Supabase SQL editor.

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
  new.commission_percent := coalesce(percent, 10);
  new.commission_amount := round(new.rent_amount * new.commission_percent / 100 * new.occupants, 2);
  if new.payment_method = 'pay_now' then
    new.payment_status := 'paid';
  end if;
  return new;
end;
$$;
