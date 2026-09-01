-- Full app reset. Run once in the Supabase SQL editor.
-- Keeps cities + universities. Deletes users, listings, chats, bookings.

drop policy if exists cities_read on public.cities;
create policy cities_read on public.cities for select using (true);

drop policy if exists universities_read on public.universities;
create policy universities_read on public.universities for select using (true);

delete from public.messages;
delete from public.conversations;
delete from public.bookings;
delete from public.apartments;

delete from auth.identities;
delete from auth.users;

update public.app_settings
set
  admin_email = 'bishara.babish23@gmail.com',
  commission_percent = 6
where id = 1;
