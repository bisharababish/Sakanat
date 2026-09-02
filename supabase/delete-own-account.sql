-- Students and renters can delete their own account (login + app data).
-- Owners and admins cannot. Run once in the Supabase SQL editor.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  my_role text;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;
  select role into my_role from public.profiles where id = auth.uid();
  if my_role is null or my_role not in ('student', 'renter') then
    raise exception 'not allowed';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
