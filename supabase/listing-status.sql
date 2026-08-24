-- Hide listings + owner re-submit after edit.
-- Run once in the Supabase SQL editor.

alter table public.apartments drop constraint if exists apartments_status_check;
alter table public.apartments
  add constraint apartments_status_check
  check (status in ('pending', 'approved', 'rejected', 'hidden'));

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
    elsif old.status = 'approved' and new.status = 'hidden' then
      new.status := 'hidden';
    elsif old.status = 'hidden' and new.status = 'approved' then
      new.status := 'approved';
    elsif new.status = 'pending' and old.status in ('pending', 'approved', 'hidden', 'rejected') then
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
