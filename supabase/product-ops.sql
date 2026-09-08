-- Product ops: search alerts push, booking SLA/auto-complete/review nudge,
-- owner insights, report-close notify, review replies, chat images.
-- Run AFTER push-triggers.sql and analytics-rate-limits.sql (safe to re-apply).

-- ─── Push enqueue with deep-link data ───────────────────────────────────────
create or replace function public.enqueue_push(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_kind text default 'booking',
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_user_id is null or coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    return;
  end if;

  select push_function_url, push_hook_secret
    into v_url, v_secret
  from public.app_settings_secrets
  where id = 1;

  if v_url is null or v_url = '' or v_secret is null or v_secret = '' or v_secret = 'CHANGE_ME_PUSH_HOOK_SECRET' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object(
      'mode', 'user',
      'userId', p_user_id,
      'title', p_title,
      'body', p_body,
      'kind', coalesce(p_kind, 'booking'),
      'data', coalesce(p_data, '{}'::jsonb)
    )
  );
exception
  when others then
    null;
end;
$$;

-- ─── Search alerts (server) ────────────────────────────────────────────────
create table if not exists public.search_alerts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  university_id uuid references public.universities(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  max_price numeric,
  max_km numeric,
  last_notified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.search_alert_hits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (user_id, apartment_id)
);

alter table public.search_alerts enable row level security;
alter table public.search_alert_hits enable row level security;

drop policy if exists search_alerts_own on public.search_alerts;
create policy search_alerts_own on public.search_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists search_alert_hits_own on public.search_alert_hits;
create policy search_alert_hits_own on public.search_alert_hits
  for select using (auth.uid() = user_id);

create or replace function public.upsert_search_alert(
  p_enabled boolean,
  p_university_id uuid default null,
  p_city_id uuid default null,
  p_max_price numeric default null,
  p_max_km numeric default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.search_alerts (user_id, enabled, university_id, city_id, max_price, max_km, updated_at)
  values (auth.uid(), p_enabled, p_university_id, p_city_id, p_max_price, p_max_km, now())
  on conflict (user_id) do update set
    enabled = excluded.enabled,
    university_id = excluded.university_id,
    city_id = excluded.city_id,
    max_price = excluded.max_price,
    max_km = excluded.max_km,
    updated_at = now();
end;
$$;

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

create or replace function public.push_on_apartment_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.notify_search_alerts_for_apartment(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists push_apartment_approved on public.apartments;
create trigger push_apartment_approved
  after insert or update of status on public.apartments
  for each row execute function public.push_on_apartment_approved();

-- ─── Booking SLA / auto-complete / review nudge ────────────────────────────
alter table public.bookings
  add column if not exists pending_reminded_at timestamptz;

alter table public.bookings
  add column if not exists review_nudged_at timestamptz;

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
begin
  -- Remind owners after 24h pending
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
        jsonb_build_object('kind', 'booking', 'bookingId', b.id)
      );
    else
      perform public.enqueue_push(
        b.owner_id,
        'حجز بانتظارك',
        'ما زال طلب حجز بانتظار ردك.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', b.id)
      );
    end if;
    update public.bookings set pending_reminded_at = now() where id = b.id;
    reminded := reminded + 1;
  end loop;

  -- Auto-cancel pending after 5 days
  for b in
    select * from public.bookings
    where status = 'pending'
      and created_at < now() - interval '5 days'
    limit 80
  loop
    update public.bookings
      set status = 'cancelled'
    where id = b.id;
    lang := coalesce(public.profile_lang(b.student_id), 'ar');
    if lang = 'en' then
      perform public.enqueue_push(
        b.student_id,
        'Booking expired',
        'Your pending booking expired with no owner reply.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', b.id)
      );
    else
      perform public.enqueue_push(
        b.student_id,
        'انتهى طلب الحجز',
        'انتهى طلبك بانتظار المالك دون رد.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', b.id)
      );
    end if;
    expired := expired + 1;
  end loop;

  -- Auto-complete stays that ended
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

  -- Review nudge once after stay ended / completed, if no review
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

  return jsonb_build_object(
    'reminded', reminded,
    'expired', expired,
    'completed', completed,
    'nudged', nudged
  );
end;
$$;

grant execute on function public.run_booking_ops() to authenticated;
grant execute on function public.upsert_search_alert(boolean, uuid, uuid, numeric, numeric) to authenticated;

-- Optional: schedule every hour if pg_cron is available
do $$
begin
  perform cron.schedule(
    'sakanat-booking-ops',
    '15 * * * *',
    $cron$ select public.run_booking_ops(); $cron$
  );
exception
  when others then
    null;
end;
$$;

-- ─── Owner listing insights ────────────────────────────────────────────────
create or replace function public.owner_listing_stats()
returns table(apartment_id uuid, views bigint, saves bigint)
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
      select count(*)::bigint
      from public.app_events e
      where e.name = 'listing_view'
        and (e.props->>'apartmentId') = a.id::text
    ), 0) as views,
    coalesce((
      select count(*)::bigint
      from public.saved_apartments s
      where s.apartment_id = a.id
    ), 0) as saves
  from public.apartments a
  where a.owner_id = auth.uid();
end;
$$;

grant execute on function public.owner_listing_stats() to authenticated;

-- ─── Report close → notify reporter ────────────────────────────────────────
create or replace function public.push_on_report_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lang text;
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    lang := coalesce(public.profile_lang(new.reporter_id), 'ar');
    if lang = 'en' then
      perform public.enqueue_push(
        new.reporter_id,
        'Report update',
        coalesce(nullif(trim(new.admin_note), ''), 'Your report was reviewed and closed.'),
        'booking',
        jsonb_build_object('kind', 'report', 'reportId', new.id)
      );
    else
      perform public.enqueue_push(
        new.reporter_id,
        'تحديث بلاغك',
        coalesce(nullif(trim(new.admin_note), ''), 'تمت مراجعة بلاغك وإغلاقه.'),
        'booking',
        jsonb_build_object('kind', 'report', 'reportId', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists push_report_closed on public.app_reports;
create trigger push_report_closed
  after update of status on public.app_reports
  for each row execute function public.push_on_report_closed();

-- ─── Owner reply on reviews ────────────────────────────────────────────────
alter table public.apartment_reviews
  add column if not exists owner_reply text;

alter table public.apartment_reviews
  add column if not exists owner_replied_at timestamptz;

create or replace function public.owner_reply_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_apartment_id uuid;
  v_owner_id uuid;
  v_student_id uuid;
  lang text;
  reply text := trim(p_reply);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if length(reply) < 2 or length(reply) > 600 then
    raise exception 'invalid reply';
  end if;

  select r.apartment_id, a.owner_id, r.student_id
    into v_apartment_id, v_owner_id, v_student_id
  from public.apartment_reviews r
  join public.apartments a on a.id = r.apartment_id
  where r.id = p_review_id;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  update public.apartment_reviews
    set owner_reply = reply,
        owner_replied_at = now()
  where id = p_review_id;

  lang := coalesce(public.profile_lang(v_student_id), 'ar');
  if lang = 'en' then
    perform public.enqueue_push(
      v_student_id,
      'Owner replied',
      left(reply, 90),
      'review',
      jsonb_build_object('kind', 'review', 'apartmentId', v_apartment_id)
    );
  else
    perform public.enqueue_push(
      v_student_id,
      'رد المالك على تقييمك',
      left(reply, 90),
      'review',
      jsonb_build_object('kind', 'review', 'apartmentId', v_apartment_id)
    );
  end if;
end;
$$;

grant execute on function public.owner_reply_review(uuid, text) to authenticated;

-- ─── Chat images ───────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists image_url text;

alter table public.messages
  alter column body drop not null;

alter table public.messages
  alter column body set default '';

do $$
begin
  alter table public.messages
    add constraint messages_body_or_image
    check (coalesce(nullif(trim(body), ''), null) is not null or coalesce(nullif(trim(image_url), ''), null) is not null);
exception
  when duplicate_object then null;
end;
$$;

-- Update chat push trigger to include conversation deep link (re-define lightly)
create or replace function public.push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
  v_preview text;
  lang text;
begin
  select case
    when c.student_id = new.sender_id then c.owner_id
    else c.student_id
  end
  into v_other
  from public.conversations c
  where c.id = new.conversation_id;

  if v_other is null then
    return new;
  end if;

  -- respect mute
  if exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id
      and (
        (c.student_id = v_other and c.student_muted)
        or (c.owner_id = v_other and c.owner_muted)
      )
  ) then
    return new;
  end if;

  lang := coalesce(public.profile_lang(v_other), 'ar');
  v_preview := coalesce(nullif(trim(new.body), ''), case when new.image_url is not null then
    case when lang = 'en' then 'Photo' else 'صورة' end
  else '' end);

  if lang = 'en' then
    perform public.enqueue_push(
      v_other,
      'New message',
      left(v_preview, 90),
      'chat',
      jsonb_build_object('kind', 'chat', 'conversationId', new.conversation_id)
    );
  else
    perform public.enqueue_push(
      v_other,
      'رسالة جديدة',
      left(v_preview, 90),
      'chat',
      jsonb_build_object('kind', 'chat', 'conversationId', new.conversation_id)
    );
  end if;
  return new;
end;
$$;
