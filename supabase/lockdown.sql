-- Admin lock, MFA on privileged writes, photo upload paths, chat blocks,
-- person cards (chat ≠ stay file), search-alert filters, legal version.

-- ---------------------------------------------------------------------------
-- Burn leaked push hook secret in the database (client JWT push still works).
-- ---------------------------------------------------------------------------
update public.app_settings_secrets
set push_hook_secret = 'CHANGE_ME_PUSH_HOOK_SECRET', updated_at = now()
where id = 1
  and coalesce(push_hook_secret, '') <> ''
  and push_hook_secret <> 'CHANGE_ME_PUSH_HOOK_SECRET';

-- ---------------------------------------------------------------------------
-- MFA: admin (and owner writes) need AAL2. Service role bypasses RLS anyway.
-- ---------------------------------------------------------------------------
create or replace function public.jwt_aal2()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
    or coalesce(auth.role(), '') = 'service_role';
$$;

grant execute on function public.jwt_aal2() to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) and public.jwt_aal2();
$$;

-- ---------------------------------------------------------------------------
-- Legal version + analytics / stay-signed-in (before handle_new_user)
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists legal_version int not null default 1;

alter table public.profiles
  add column if not exists accepted_legal_version int;
alter table public.profiles
  add column if not exists analytics_consent boolean not null default true;
alter table public.profiles
  add column if not exists keep_signed_in boolean not null default false;

update public.app_settings set legal_version = 1 where id = 1;
update public.profiles
set accepted_legal_version = 1
where accepted_terms_at is not null and accepted_legal_version is null;

create or replace function public.read_platform_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.app_settings;
  admin boolean;
begin
  select * into row from public.app_settings where id = 1;
  if row.id is null then
    return '{}'::jsonb;
  end if;
  admin := public.is_admin();
  return jsonb_build_object(
    'commission_percent', row.commission_percent,
    'legal_version', row.legal_version,
    'admin_email', case when admin then row.admin_email else null end
  );
end;
$$;

revoke all on function public.read_platform_settings() from public;
grant execute on function public.read_platform_settings() to authenticated;

create or replace function public.save_platform_settings(p_commission numeric, p_admin_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_commission is null or p_commission < 0 or p_commission > 100 then
    raise exception 'invalid_commission' using errcode = 'P0001';
  end if;
  if p_admin_email is null or position('@' in p_admin_email) = 0 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  update public.app_settings
  set
    commission_percent = p_commission,
    admin_email = lower(btrim(p_admin_email)),
    updated_at = now()
  where id = 1;
end;
$$;

revoke all on function public.save_platform_settings(numeric, text) from public;
grant execute on function public.save_platform_settings(numeric, text) to authenticated;

drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings
  for select to authenticated
  using (true);

drop policy if exists settings_read_anon on public.app_settings;
create policy settings_read_anon on public.app_settings
  for select to anon
  using (true);

revoke select on public.app_settings from anon, authenticated;
grant select (id, commission_percent, legal_version, updated_at)
  on public.app_settings to anon, authenticated;

create or replace function public.claim_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select false;
$$;

revoke all on function public.claim_admin() from public, anon, authenticated;

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
  legal int;
begin
  if coalesce(new.raw_user_meta_data->>'role', '') in ('student', 'renter') then
    meta_role := new.raw_user_meta_data->>'role';
  else
    meta_role := 'student';
  end if;

  select admin_email, legal_version into settings_admin, legal from public.app_settings where id = 1;
  if settings_admin is not null and lower(new.email) = lower(settings_admin) then
    meta_role := 'admin';
  end if;

  begin
    terms_at := nullif(new.raw_user_meta_data->>'accepted_terms_at', '')::timestamptz;
  exception when others then
    terms_at := null;
  end;

  insert into public.profiles (
    id, email, full_name, phone, role, city_id, university_id, owner_status, language,
    account_status, accepted_terms_at, accepted_legal_version, analytics_consent, keep_signed_in
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
    terms_at,
    case when terms_at is not null then coalesce(legal, 1) else null end,
    true,
    false
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner listing writes require MFA
-- ---------------------------------------------------------------------------
drop policy if exists apartments_update on public.apartments;
create policy apartments_update on public.apartments
  for update to authenticated
  using (public.is_admin() or (owner_id = auth.uid() and public.jwt_aal2()))
  with check (public.is_admin() or (owner_id = auth.uid() and public.jwt_aal2()));

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated
  with check (public.is_admin() or (owner_id = auth.uid() and public.jwt_aal2()));

drop policy if exists apartments_delete on public.apartments;
create policy apartments_delete on public.apartments
  for delete to authenticated
  using (public.is_admin() or (owner_id = auth.uid() and public.jwt_aal2()));

drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings
  for update to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or (owner_id = auth.uid() and public.jwt_aal2())
  )
  with check (
    student_id = auth.uid()
    or public.is_admin()
    or (owner_id = auth.uid() and public.jwt_aal2())
  );

-- ---------------------------------------------------------------------------
-- Chat ≠ stay file. Full profile only: self, admin, booking counterpart.
-- ---------------------------------------------------------------------------
drop view if exists public.person_cards;
create view public.person_cards
with (security_invoker = false, security_barrier = true) as
select
  p.id,
  p.full_name,
  p.full_name_en,
  p.avatar_url,
  p.role,
  p.gender,
  p.date_of_birth,
  p.city_id,
  p.university_id,
  p.major,
  p.study_year,
  p.degree_level,
  p.bio,
  p.spoken_languages,
  p.phone_visibility,
  p.whatsapp_visibility,
  p.id_verify_status,
  p.graduation_term
from public.profiles p
where
  p.role = 'owner'
  or p.id = auth.uid()
  or exists (
    select 1 from public.bookings b
    where (b.student_id = p.id and b.owner_id = auth.uid())
       or (b.owner_id = p.id and b.student_id = auth.uid())
  )
  or exists (
    select 1 from public.conversations c
    where (c.student_id = p.id and c.owner_id = auth.uid())
       or (c.owner_id = p.id and c.student_id = auth.uid())
  )
  or exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = auth.uid() and ub.blocked_id = p.id)
       or (ub.blocked_id = auth.uid() and ub.blocker_id = p.id)
  );

grant select on public.person_cards to anon, authenticated;

-- Stay file: booking counterpart only. ID number / home / card paths wait until confirm.
drop view if exists public.stay_peer_cards;
create view public.stay_peer_cards
with (security_invoker = false, security_barrier = true) as
select
  p.id,
  p.full_name,
  p.full_name_en,
  p.avatar_url,
  p.role,
  p.gender,
  p.date_of_birth,
  p.city_id,
  p.university_id,
  p.major,
  p.study_year,
  p.degree_level,
  p.bio,
  p.spoken_languages,
  p.phone,
  p.email,
  p.whatsapp,
  p.phone_visibility,
  p.whatsapp_visibility,
  p.id_verify_status,
  p.graduation_term,
  p.student_id_number,
  p.hide_last_seen,
  p.share_emergency,
  case when exists (
    select 1 from public.bookings b
    where ((b.student_id = p.id and b.owner_id = auth.uid())
        or (b.owner_id = p.id and b.student_id = auth.uid()))
      and b.status in ('confirmed', 'completed')
  ) then p.home_address else null end as home_address,
  case when exists (
    select 1 from public.bookings b
    where ((b.student_id = p.id and b.owner_id = auth.uid())
        or (b.owner_id = p.id and b.student_id = auth.uid()))
      and b.status in ('confirmed', 'completed')
  ) then p.national_id_number else null end as national_id_number,
  case when exists (
    select 1 from public.bookings b
    where ((b.student_id = p.id and b.owner_id = auth.uid())
        or (b.owner_id = p.id and b.student_id = auth.uid()))
      and b.status in ('confirmed', 'completed')
  ) then p.national_id_url else null end as national_id_url,
  case when exists (
    select 1 from public.bookings b
    where ((b.student_id = p.id and b.owner_id = auth.uid())
        or (b.owner_id = p.id and b.student_id = auth.uid()))
      and b.status in ('confirmed', 'completed')
  ) then p.university_card_url else null end as university_card_url,
  case when p.share_emergency is not false then p.emergency_name else null end as emergency_name,
  case when p.share_emergency is not false then p.emergency_phone else null end as emergency_phone
from public.profiles p
where
  p.id = auth.uid()
  or exists (
    select 1 from public.bookings b
    where (b.student_id = p.id and b.owner_id = auth.uid())
       or (b.owner_id = p.id and b.student_id = auth.uid())
  );

grant select on public.stay_peer_cards to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Blocks enforced on chat insert
-- ---------------------------------------------------------------------------
create or replace function public.blocked_either_way(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

grant execute on function public.blocked_either_way(uuid, uuid) to authenticated;

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (
    (student_id = auth.uid() or owner_id = auth.uid())
    and not public.blocked_either_way(student_id, owner_id)
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.student_id = auth.uid() or c.owner_id = auth.uid())
        and not public.blocked_either_way(c.student_id, c.owner_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Listing photos: own folder (or avatars/uid), or admin
-- ---------------------------------------------------------------------------
drop policy if exists apartment_photos_insert on storage.objects;
create policy apartment_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'apartment-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists apartment_photos_update on storage.objects;
create policy apartment_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'apartment-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'apartment-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists apartment_photos_delete on storage.objects;
create policy apartment_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'apartment-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Search alerts: rooms, baths, amenities, gender, query, verified
-- ---------------------------------------------------------------------------
alter table public.search_alerts
  add column if not exists rooms text;
alter table public.search_alerts
  add column if not exists baths text;
alter table public.search_alerts
  add column if not exists amenities text[] not null default '{}';
alter table public.search_alerts
  add column if not exists gender text;
alter table public.search_alerts
  add column if not exists query text;
alter table public.search_alerts
  add column if not exists verified_only boolean not null default false;

drop function if exists public.upsert_search_alert(boolean, uuid, uuid, numeric, numeric);

create or replace function public.upsert_search_alert(
  p_enabled boolean,
  p_university_id uuid default null,
  p_city_id uuid default null,
  p_max_price numeric default null,
  p_max_km numeric default null,
  p_rooms text default null,
  p_baths text default null,
  p_amenities text[] default null,
  p_gender text default null,
  p_query text default null,
  p_verified_only boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.search_alerts (
    user_id, enabled, university_id, city_id, max_price, max_km,
    rooms, baths, amenities, gender, query, verified_only, updated_at
  )
  values (
    auth.uid(), p_enabled, p_university_id, p_city_id, p_max_price, p_max_km,
    nullif(btrim(coalesce(p_rooms, '')), ''),
    nullif(btrim(coalesce(p_baths, '')), ''),
    coalesce(p_amenities, '{}'),
    nullif(btrim(coalesce(p_gender, '')), ''),
    nullif(btrim(coalesce(p_query, '')), ''),
    coalesce(p_verified_only, false),
    now()
  )
  on conflict (user_id) do update set
    enabled = excluded.enabled,
    university_id = excluded.university_id,
    city_id = excluded.city_id,
    max_price = excluded.max_price,
    max_km = excluded.max_km,
    rooms = excluded.rooms,
    baths = excluded.baths,
    amenities = excluded.amenities,
    gender = excluded.gender,
    query = excluded.query,
    verified_only = excluded.verified_only,
    updated_at = now();
end;
$$;

grant execute on function public.upsert_search_alert(boolean, uuid, uuid, numeric, numeric, text, text, text[], text, text, boolean) to authenticated;

create or replace function public.get_search_alert()
returns table (
  enabled boolean,
  university_id uuid,
  city_id uuid,
  max_price numeric,
  max_km numeric,
  rooms text,
  baths text,
  amenities text[],
  gender text,
  query text,
  verified_only boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
  select
    s.enabled, s.university_id, s.city_id, s.max_price, s.max_km,
    s.rooms, s.baths, s.amenities, s.gender, s.query, s.verified_only
  from public.search_alerts s
  where s.user_id = auth.uid();
end;
$$;

grant execute on function public.get_search_alert() to authenticated;

create or replace function public.notify_search_alerts_for_apartment(p_apartment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  apt public.apartments%rowtype;
  alert_row public.search_alerts%rowtype;
  lang text;
  dist_km double precision;
  uni_lat double precision;
  uni_lng double precision;
  city_lat double precision;
  city_lng double precision;
  owner_verify text;
  haystack text;
begin
  select * into apt from public.apartments where id = p_apartment_id and status = 'approved';
  if not found then
    return;
  end if;

  select id_verify_status into owner_verify from public.profiles where id = apt.owner_id;

  for alert_row in
    select * from public.search_alerts
    where enabled = true
      and (university_id is null or university_id = apt.nearest_university_id)
      and (city_id is null or city_id = apt.city_id)
      and (max_price is null or apt.price_month <= max_price)
      and (last_notified_at is null or last_notified_at < now() - interval '4 hours')
  loop
    if exists (
      select 1 from public.search_alert_hits
      where user_id = alert_row.user_id and apartment_id = apt.id
    ) then
      continue;
    end if;

    if alert_row.rooms is not null then
      if alert_row.rooms = '4' then
        if apt.rooms < 4 then continue; end if;
      elsif apt.rooms is distinct from alert_row.rooms::int then
        continue;
      end if;
    end if;

    if alert_row.baths is not null then
      if alert_row.baths = '3' then
        if apt.bathrooms < 3 then continue; end if;
      elsif apt.bathrooms is distinct from alert_row.baths::int then
        continue;
      end if;
    end if;

    if coalesce(array_length(alert_row.amenities, 1), 0) > 0
       and not (coalesce(apt.amenities, '{}') @> alert_row.amenities) then
      continue;
    end if;

    if alert_row.gender is not null and alert_row.gender not in ('', 'all', 'suitable') then
      if apt.gender_policy is distinct from 'any' and apt.gender_policy is distinct from alert_row.gender then
        continue;
      end if;
    end if;

    if alert_row.verified_only and owner_verify is distinct from 'approved' then
      continue;
    end if;

    if nullif(btrim(coalesce(alert_row.query, '')), '') is not null then
      haystack := lower(concat_ws(' ', apt.title_ar, apt.title_en, apt.description_ar, apt.description_en, apt.building_name, apt.unit_number));
      if position(lower(alert_row.query) in haystack) = 0 then
        continue;
      end if;
    end if;

    if alert_row.max_km is not null then
      dist_km := null;
      if alert_row.university_id is not null then
        select u.lat, u.lng into uni_lat, uni_lng
        from public.universities u where u.id = alert_row.university_id;
        dist_km := public.haversine_km(apt.lat, apt.lng, uni_lat, uni_lng);
        if dist_km is null
           and apt.nearest_university_id = alert_row.university_id
           and apt.campus_distance_km is not null then
          dist_km := apt.campus_distance_km;
        end if;
      elsif alert_row.city_id is not null then
        select c.lat, c.lng into city_lat, city_lng
        from public.cities c where c.id = alert_row.city_id;
        dist_km := public.haversine_km(apt.lat, apt.lng, city_lat, city_lng);
      else
        dist_km := apt.campus_distance_km;
      end if;
      if dist_km is null or dist_km > alert_row.max_km then
        continue;
      end if;
    end if;

    lang := coalesce(public.profile_lang(alert_row.user_id), 'ar');
    if lang = 'en' then
      perform public.enqueue_push(
        alert_row.user_id,
        'New listing match',
        'A place matches your saved search.',
        'listing',
        jsonb_build_object('kind', 'listing', 'apartmentId', apt.id)
      );
    else
      perform public.enqueue_push(
        alert_row.user_id,
        'سكن جديد يطابق بحثك',
        'ظهر مكان يطابق تنبيه البحث المحفوظ.',
        'listing',
        jsonb_build_object('kind', 'listing', 'apartmentId', apt.id)
      );
    end if;

    insert into public.search_alert_hits (user_id, apartment_id)
    values (alert_row.user_id, apt.id)
    on conflict do nothing;

    update public.search_alerts
      set last_notified_at = now()
    where user_id = alert_row.user_id;
  end loop;
end;
$$;

create or replace function public.haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 2 * 6371 * asin(least(1.0, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    )))
  end;
$$;

-- ---------------------------------------------------------------------------
-- Analytics: no anonymous spam inserts
-- ---------------------------------------------------------------------------
drop policy if exists app_events_insert_own on public.app_events;
create policy app_events_insert_own on public.app_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Push send log (rate limit from the edge function)
-- ---------------------------------------------------------------------------
create table if not exists public.push_send_log (
  id bigint generated always as identity primary key,
  caller_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists push_send_log_caller_idx on public.push_send_log (caller_id, created_at desc);
alter table public.push_send_log enable row level security;
