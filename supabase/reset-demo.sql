-- Run this once in the Supabase SQL editor.
-- Clears demo listings/accounts and lets guests read cities + universities.

drop policy if exists cities_read on public.cities;
create policy cities_read on public.cities for select using (true);

drop policy if exists universities_read on public.universities;
create policy universities_read on public.universities for select using (true);

delete from public.messages;
delete from public.conversations;
delete from public.bookings;
delete from public.apartments;

delete from auth.identities
where user_id in (
  select id from auth.users
  where email in (
    'admin@sakanat.app',
    'owner@demo.sakanat.app',
    'student@stu.birzeit.edu'
  )
);

delete from auth.users
where email in (
  'admin@sakanat.app',
  'owner@demo.sakanat.app',
  'student@stu.birzeit.edu'
);

update public.app_settings
set admin_email = 'bishara@gmail.com'
where id = 1;

update public.profiles
set role = 'admin', owner_status = 'approved'
where email = 'bishara@gmail.com';
