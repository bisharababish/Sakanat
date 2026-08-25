-- Public signup is always a student. Owners are created later by an admin
-- (Admin → Users → Create owner), which updates profiles.role after insert.
-- Run once in the Supabase SQL editor.

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
  meta_role := 'student';

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
