-- Product ops v2 — run AFTER product-ops.sql (safe to re-apply).
-- Hook URL/secret: do NOT edit here — already in app_settings_secrets from push-triggers.sql.

-- ─── Haversine helper (km) ─────────────────────────────────────────────────
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

-- ─── Search alerts honor max_km ────────────────────────────────────────────
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
begin
  select * into apt from public.apartments where id = p_apartment_id and status = 'approved';
  if not found then
    return;
  end if;

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

    -- Distance filter
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

-- ─── Load search alert from server ─────────────────────────────────────────
create or replace function public.get_search_alert()
returns table (
  enabled boolean,
  university_id uuid,
  city_id uuid,
  max_price numeric,
  max_km numeric
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
  select s.enabled, s.university_id, s.city_id, s.max_price, s.max_km
  from public.search_alerts s
  where s.user_id = auth.uid();
end;
$$;

grant execute on function public.get_search_alert() to authenticated;

-- ─── Booking ops status (cron + last run) ──────────────────────────────────
create table if not exists public.app_ops_meta (
  id int primary key default 1 check (id = 1),
  booking_ops_last_at timestamptz,
  booking_ops_last_result jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_ops_meta (id) values (1)
on conflict (id) do nothing;

alter table public.app_ops_meta enable row level security;

drop policy if exists app_ops_meta_admin_read on public.app_ops_meta;
create policy app_ops_meta_admin_read on public.app_ops_meta
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.run_booking_ops()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reminded int := 0;
  expired int := 0;
  completed int := 0;
  nudged int := 0;
  b record;
  lang text;
  end_date date;
  result jsonb;
begin
  for b in
    select * from public.bookings
    where status = 'pending'
      and created_at < now() - interval '24 hours'
      and pending_reminded_at is null
    limit 80
  loop
    lang := coalesce(public.profile_lang(b.owner_id), 'ar');
    if lang = 'en' then
      perform public.enqueue_push(
        b.owner_id,
        'Booking still waiting',
        'A booking request is still pending your reply.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', b.id, 'apartmentId', b.apartment_id)
      );
    else
      perform public.enqueue_push(
        b.owner_id,
        'حجز بانتظارك',
        'ما زال طلب حجز بانتظار ردك.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', b.id, 'apartmentId', b.apartment_id)
      );
    end if;
    update public.bookings set pending_reminded_at = now() where id = b.id;
    reminded := reminded + 1;
  end loop;

  for b in
    select * from public.bookings
    where status = 'pending'
      and created_at < now() - interval '5 days'
    limit 80
  loop
    update public.bookings set status = 'cancelled' where id = b.id;
    lang := coalesce(public.profile_lang(b.student_id), 'ar');
    if lang = 'en' then
      perform public.enqueue_push(
        b.student_id,
        'Booking expired',
        'Your pending booking expired with no owner reply.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', b.id, 'apartmentId', b.apartment_id)
      );
    else
      perform public.enqueue_push(
        b.student_id,
        'انتهى طلب الحجز',
        'انتهى طلبك بانتظار المالك دون رد.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', b.id, 'apartmentId', b.apartment_id)
      );
    end if;
    expired := expired + 1;
  end loop;

  for b in
    select * from public.bookings
    where status = 'confirmed'
    limit 200
  loop
    end_date := (b.start_date + ((greatest(coalesce(b.months, 1), 1) || ' months')::interval))::date;
    if end_date < current_date then
      update public.bookings set status = 'completed' where id = b.id and status = 'confirmed';
      completed := completed + 1;
    end if;
  end loop;

  for b in
    select bk.*
    from public.bookings bk
    where bk.status in ('completed', 'confirmed')
      and bk.review_nudged_at is null
      and not exists (select 1 from public.apartment_reviews r where r.booking_id = bk.id)
    limit 80
  loop
    end_date := (b.start_date + ((greatest(coalesce(b.months, 1), 1) || ' months')::interval))::date;
    if b.status = 'completed' or end_date < current_date then
      lang := coalesce(public.profile_lang(b.student_id), 'ar');
      if lang = 'en' then
        perform public.enqueue_push(
          b.student_id,
          'Leave a review',
          'How was your stay? A short review helps other students.',
          'review',
          jsonb_build_object('kind', 'review', 'bookingId', b.id, 'apartmentId', b.apartment_id)
        );
      else
        perform public.enqueue_push(
          b.student_id,
          'اكتب تقييماً',
          'كيف كانت إقامتك؟ تقييم قصير يساعد طلاباً آخرين.',
          'review',
          jsonb_build_object('kind', 'review', 'bookingId', b.id, 'apartmentId', b.apartment_id)
        );
      end if;
      update public.bookings set review_nudged_at = now() where id = b.id;
      nudged := nudged + 1;
    end if;
  end loop;

  result := jsonb_build_object(
    'reminded', reminded,
    'expired', expired,
    'completed', completed,
    'nudged', nudged
  );

  insert into public.app_ops_meta (id, booking_ops_last_at, booking_ops_last_result, updated_at)
  values (1, now(), result, now())
  on conflict (id) do update set
    booking_ops_last_at = excluded.booking_ops_last_at,
    booking_ops_last_result = excluded.booking_ops_last_result,
    updated_at = now();

  return result;
end;
$$;

create or replace function public.booking_ops_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  meta public.app_ops_meta%rowtype;
  cron_on boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'forbidden';
  end if;

  select * into meta from public.app_ops_meta where id = 1;

  begin
    select exists (
      select 1 from cron.job where jobname = 'sakanat-booking-ops'
    ) into cron_on;
  exception
    when others then
      cron_on := false;
  end;

  return jsonb_build_object(
    'cronScheduled', cron_on,
    'lastAt', meta.booking_ops_last_at,
    'lastResult', meta.booking_ops_last_result
  );
end;
$$;

grant execute on function public.booking_ops_status() to authenticated;

-- Re-schedule cron (no-op if extension missing)
do $$
begin
  perform cron.unschedule('sakanat-booking-ops');
exception when others then null;
end;
$$;

do $$
begin
  perform cron.schedule(
    'sakanat-booking-ops',
    '15 * * * *',
    $cron$ select public.run_booking_ops(); $cron$
  );
exception when others then null;
end;
$$;

-- ─── Owner insights v2 ─────────────────────────────────────────────────────
create or replace function public.owner_listing_stats()
returns table(
  apartment_id uuid,
  views bigint,
  saves bigint,
  chats bigint,
  bookings bigint
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
    a.id as apartment_id,
    coalesce((
      select count(*)::bigint from public.app_events e
      where e.name = 'listing_view' and (e.props->>'apartmentId') = a.id::text
    ), 0) as views,
    coalesce((
      select count(*)::bigint from public.saved_apartments s where s.apartment_id = a.id
    ), 0) as saves,
    coalesce((
      select count(*)::bigint from public.conversations c where c.apartment_id = a.id
    ), 0) as chats,
    coalesce((
      select count(*)::bigint from public.bookings b where b.apartment_id = a.id
    ), 0) as bookings
  from public.apartments a
  where a.owner_id = auth.uid();
end;
$$;

grant execute on function public.owner_listing_stats() to authenticated;

-- ─── Private chat photos bucket ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', false)
on conflict (id) do update set public = false;

drop policy if exists chat_photos_select on storage.objects;
create policy chat_photos_select on storage.objects
  for select using (
    bucket_id = 'chat-photos'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.student_id = auth.uid() or c.owner_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

drop policy if exists chat_photos_insert on storage.objects;
create policy chat_photos_insert on storage.objects
  for insert with check (
    bucket_id = 'chat-photos'
    and auth.uid()::text = (storage.foldername(name))[2]
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.student_id = auth.uid() or c.owner_id = auth.uid())
    )
  );
