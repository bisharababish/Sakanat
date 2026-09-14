-- Voice notes on chat messages. Run in the Supabase SQL editor.
-- Stores audio in the existing private chat-photos bucket (same RLS as photos).

alter table public.messages
  add column if not exists audio_url text;

alter table public.messages
  drop constraint if exists messages_body_or_image;

alter table public.messages
  drop constraint if exists messages_body_or_media;

alter table public.messages
  add constraint messages_body_or_media
  check (
    coalesce(nullif(trim(body), ''), null) is not null
    or coalesce(nullif(trim(image_url), ''), null) is not null
    or coalesce(nullif(trim(audio_url), ''), null) is not null
  );

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
  v_preview := coalesce(nullif(trim(new.body), ''),
    case
      when new.image_url is not null then case when lang = 'en' then 'Photo' else 'صورة' end
      when new.audio_url is not null then case when lang = 'en' then 'Voice message' else 'رسالة صوتية' end
      else ''
    end
  );

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
