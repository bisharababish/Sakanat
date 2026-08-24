-- Run once in the Supabase SQL editor.
-- Makes bishara.babish23@gmail.com the admin.

update public.app_settings
set admin_email = 'bishara.babish23@gmail.com'
where id = 1;

create or replace function public.claim_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_admin text;
  user_email text;
begin
  select admin_email into settings_admin from public.app_settings where id = 1;
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null or lower(user_email) <> lower(coalesce(settings_admin, 'bishara.babish23@gmail.com')) then
    return false;
  end if;
  update public.profiles
    set role = 'admin', owner_status = 'approved'
    where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.claim_admin() to authenticated;

update public.profiles
set role = 'admin', owner_status = 'approved'
where lower(email) = 'bishara.babish23@gmail.com';
