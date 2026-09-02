-- Let an admin turn off Google Authenticator for someone who lost their phone.
-- Run once in the Supabase SQL editor.

create or replace function public.admin_unenroll_mfa(target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if target = auth.uid() then
    raise exception 'cannot unenroll self';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = target and role <> 'admin'
  ) then
    raise exception 'not allowed';
  end if;
  delete from auth.mfa_factors where user_id = target;
end;
$$;

revoke all on function public.admin_unenroll_mfa(uuid) from public;
grant execute on function public.admin_unenroll_mfa(uuid) to authenticated;
