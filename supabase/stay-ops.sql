-- Occupancy without exposing who is staying. Safe for search and booking gates.

create or replace function public.occupied_listing_ids()
returns table(apartment_id uuid, start_date date, months int)
language sql
stable
security definer
set search_path = public
as $$
  select b.apartment_id, b.start_date, b.months
  from public.bookings b
  where b.status = 'confirmed'
    and (b.start_date + make_interval(months => b.months))::date > current_date;
$$;

revoke all on function public.occupied_listing_ids() from public;
grant execute on function public.occupied_listing_ids() to anon, authenticated;

create or replace function public.booking_occupancy_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  if exists (
    select 1
    from public.bookings b
    where b.apartment_id = new.apartment_id
      and b.id is distinct from new.id
      and b.status = 'confirmed'
      and new.start_date < (b.start_date + make_interval(months => b.months))::date
      and b.start_date < (new.start_date + make_interval(months => new.months))::date
  ) then
    raise exception 'BOOKING_LISTING_OCCUPIED';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_occupancy_guard on public.bookings;
create trigger booking_occupancy_guard
  before insert or update of status, start_date, months, apartment_id
  on public.bookings
  for each row
  execute function public.booking_occupancy_guard();
