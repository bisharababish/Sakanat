-- Owner listing gates: approved account + trust profile before create/unhide.
-- Run in Supabase SQL editor AFTER owner-profile.sql (and booking-student-gates.sql
-- for national_id_checksum_ok / is_valid_mobile_e164 if those helpers are missing).
--
-- Stable exception messages (match in the app):
--   LISTING_OWNER_PENDING
--   LISTING_OWNER_SUSPENDED
--   LISTING_NEED_PROFILE

create or replace function public.owner_profile_ready_for_listing(p public.profiles)
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  if p.id is null or p.role <> 'owner' then
    return false;
  end if;
  if coalesce(p.account_status, 'active') <> 'active' then
    return false;
  end if;
  if coalesce(p.owner_status, 'pending') <> 'approved' then
    return false;
  end if;
  if nullif(btrim(p.full_name), '') is null
     or nullif(btrim(p.full_name_en), '') is null
     or not public.is_valid_mobile_e164(p.phone)
     or not public.is_valid_mobile_e164(p.whatsapp)
     or p.gender is null
     or p.city_id is null
     or p.date_of_birth is null
     or nullif(btrim(p.avatar_url), '') is null
     or coalesce(p.national_id_number, '') !~ '^[0-9]{9}$'
     or not public.national_id_checksum_ok(p.national_id_number)
     or p.national_id_expires_at is null
     or (p.national_id_expires_at::date < current_date)
     or nullif(btrim(p.national_id_url), '') is null
     or p.id_docs_consent_at is null
     or coalesce(p.id_verify_status, 'none') <> 'approved'
     or char_length(btrim(coalesce(p.emergency_name, ''))) < 5
     or not public.is_valid_mobile_e164(p.emergency_phone)
     or p.emergency_phone = p.phone
  then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.assert_owner_can_list(owner_uuid uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_row public.profiles;
begin
  select * into owner_row from public.profiles where id = owner_uuid;
  if owner_row.id is null or owner_row.role <> 'owner' then
    raise exception 'LISTING_NEED_PROFILE' using errcode = 'P0001';
  end if;
  if coalesce(owner_row.account_status, 'active') <> 'active' then
    raise exception 'LISTING_OWNER_SUSPENDED' using errcode = 'P0001';
  end if;
  if coalesce(owner_row.owner_status, 'pending') = 'pending' then
    raise exception 'LISTING_OWNER_PENDING' using errcode = 'P0001';
  end if;
  if coalesce(owner_row.owner_status, 'pending') = 'rejected' then
    raise exception 'LISTING_OWNER_SUSPENDED' using errcode = 'P0001';
  end if;
  if not public.owner_profile_ready_for_listing(owner_row) then
    raise exception 'LISTING_NEED_PROFILE' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.enforce_owner_listing_gates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins can always manage listings for any owner.
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.assert_owner_can_list(new.owner_id);
    return new;
  end if;

  -- Unhide / re-approve must re-check owner readiness.
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status in ('pending', 'approved')
     and old.status in ('hidden', 'rejected')
  then
    perform public.assert_owner_can_list(new.owner_id);
  end if;

  return new;
end;
$$;

drop trigger if exists apartments_owner_listing_gates on public.apartments;
create trigger apartments_owner_listing_gates
  before insert or update on public.apartments
  for each row
  execute function public.enforce_owner_listing_gates();

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      owner_id = auth.uid()
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'owner'
          and coalesce(p.account_status, 'active') = 'active'
          and p.owner_status = 'approved'
          and public.owner_profile_ready_for_listing(p)
      )
    )
  );

drop policy if exists apartments_update on public.apartments;
create policy apartments_update on public.apartments
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
