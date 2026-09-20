-- Re-run this whole file after analytics-rate-limits.sql (safe to re-apply).
-- Push titles/bodies follow recipient profiles.language (ar default, en when set).

create extension if not exists pg_net with schema extensions;

create table if not exists public.app_settings_secrets (
  id int primary key default 1 check (id = 1),
  push_function_url text,
  push_hook_secret text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings_secrets (id, push_function_url, push_hook_secret)
values (
  1,
  'https://lnyozqdnxfwzgrwtcxjc.supabase.co/functions/v1/push-send',
  'CHANGE_ME_PUSH_HOOK_SECRET'
)
on conflict (id) do update
set
  push_function_url = excluded.push_function_url,
  updated_at = now();

alter table public.app_settings_secrets enable row level security;

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

create or replace function public.profile_lang(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when language = 'en' then 'en' else 'ar' end
  from public.profiles
  where id = p_user_id;
$$;

create or replace function public.push_on_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lang text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    lang := coalesce(public.profile_lang(new.owner_id), 'ar');
    if lang = 'en' then
      perform public.enqueue_push(
        new.owner_id,
        'New booking request',
        'A student requested your apartment.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', new.id, 'apartmentId', new.apartment_id)
      );
    else
      perform public.enqueue_push(
        new.owner_id,
        'طلب حجز جديد',
        'طالب طلب حجز شقتك.',
        'booking',
        jsonb_build_object('kind', 'booking', 'bookingId', new.id, 'apartmentId', new.apartment_id)
      );
    end if;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    lang := coalesce(public.profile_lang(new.student_id), 'ar');
    if new.status = 'confirmed' then
      if lang = 'en' then
        perform public.enqueue_push(
          new.student_id,
          'Booking approved',
          'Your booking was approved.',
          'booking',
          jsonb_build_object('kind', 'booking', 'bookingId', new.id, 'apartmentId', new.apartment_id)
        );
      else
        perform public.enqueue_push(
          new.student_id,
          'تمت الموافقة على الحجز',
          'وافق المالك على حجزك.',
          'booking',
          jsonb_build_object('kind', 'booking', 'bookingId', new.id, 'apartmentId', new.apartment_id)
        );
      end if;
    elsif new.status in ('cancelled', 'rejected') then
      if lang = 'en' then
        perform public.enqueue_push(
          new.student_id,
          'Booking update',
          'Your booking was ' || new.status || '.',
          'booking',
          jsonb_build_object('kind', 'booking', 'bookingId', new.id, 'apartmentId', new.apartment_id)
        );
      else
        perform public.enqueue_push(
          new.student_id,
          'تحديث الحجز',
          case
            when new.status = 'cancelled' then 'تم إلغاء حجزك.'
            else 'تم رفض حجزك.'
          end,
          'booking',
          jsonb_build_object('kind', 'booking', 'bookingId', new.id, 'apartmentId', new.apartment_id)
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists push_booking_change on public.bookings;
create trigger push_booking_change
  after insert or update of status on public.bookings
  for each row execute function public.push_on_booking_change();

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

  lang := coalesce(public.profile_lang(v_other), 'ar');
  v_preview := left(coalesce(new.body, ''), 90);
  if lang = 'en' then
    perform public.enqueue_push(v_other, 'New message', v_preview, 'chat');
  else
    perform public.enqueue_push(v_other, 'رسالة جديدة', v_preview, 'chat');
  end if;
  return new;
end;
$$;

drop trigger if exists push_message_insert on public.messages;
create trigger push_message_insert
  after insert on public.messages
  for each row execute function public.push_on_message();

create or replace function public.push_on_listing_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lang text;
  reject_note text;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    lang := coalesce(public.profile_lang(new.owner_id), 'ar');
    if new.status = 'approved' then
      if lang = 'en' then
        perform public.enqueue_push(
          new.owner_id,
          'Your listing is live',
          'An apartment you added was approved and is now visible in search.',
          'listing'
        );
      else
        perform public.enqueue_push(
          new.owner_id,
          'إعلانك أصبح ظاهراً',
          'تمت الموافقة على شقتك وهي الآن ظاهرة في البحث.',
          'listing'
        );
      end if;
    elsif new.status = 'rejected' then
      reject_note := nullif(trim(coalesce(new.reject_reason, '')), '');
      if lang = 'en' then
        perform public.enqueue_push(
          new.owner_id,
          'Listing needs changes',
          coalesce(reject_note, 'An admin rejected your listing.'),
          'listing'
        );
      else
        perform public.enqueue_push(
          new.owner_id,
          'الإعلان يحتاج تعديلات',
          coalesce(reject_note, 'رفض المدير إعلانك.'),
          'listing'
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists push_listing_status on public.apartments;
create trigger push_listing_status
  after update of status on public.apartments
  for each row execute function public.push_on_listing_status();
