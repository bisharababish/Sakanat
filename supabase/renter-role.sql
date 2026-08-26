-- Public signup: student (campus .edu / .edu.ps) or renter (workers, families).
-- Owners still cannot self-register; the admin creates those accounts.
-- Run once in the Supabase SQL editor.
-- After this, also run supabase/account-moderation.sql. Do not re-run this file
-- after that, or you will overwrite the newer handle_new_user().

do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* 'role'
      and pg_get_constraintdef(oid) ~* 'student'
  loop
    execute format('alter table public.profiles drop constraint %I', cname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'renter', 'owner', 'admin'));

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
  if coalesce(new.raw_user_meta_data->>'role', '') in ('student', 'renter') then
    meta_role := new.raw_user_meta_data->>'role';
  else
    meta_role := 'student';
  end if;

  select admin_email into settings_admin from public.app_settings where id = 1;
  if lower(new.email) = lower(coalesce(settings_admin, 'bishara.babish23@gmail.com')) then
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
    'approved',
    coalesce(new.raw_user_meta_data->>'language', 'ar')
  );
  return new;
end;
$$;
