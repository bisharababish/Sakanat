-- Terms timestamp, suspend-without-delete, and hard-delete (auth + app data).
-- Run once in the Supabase SQL editor.

alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'suspended'));

alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;

update public.profiles
set account_status = 'suspended'
where role = 'owner' and owner_status = 'rejected' and account_status = 'active';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
  settings_admin text;
  terms_at timestamptz;
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

  begin
    terms_at := nullif(new.raw_user_meta_data->>'accepted_terms_at', '')::timestamptz;
  exception when others then
    terms_at := null;
  end;

  insert into public.profiles (
    id, email, full_name, phone, role, city_id, university_id, owner_status, language, account_status, accepted_terms_at
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    meta_role,
    nullif(new.raw_user_meta_data->>'city_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'university_id', '')::uuid,
    'approved',
    coalesce(new.raw_user_meta_data->>'language', 'ar'),
    'active',
    terms_at
  );
  return new;
end;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.account_status := old.account_status;
    if old.role = 'owner' and new.owner_status is distinct from old.owner_status then
      new.owner_status := old.owner_status;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_role text;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if target = auth.uid() then
    raise exception 'cannot delete self';
  end if;
  select role into target_role from public.profiles where id = target;
  if target_role is null then
    return;
  end if;
  if target_role = 'admin' then
    raise exception 'cannot delete admin';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
