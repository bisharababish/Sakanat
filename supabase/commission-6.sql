-- Set platform commission to 6%. Run once in the Supabase SQL editor.

alter table public.app_settings
  alter column commission_percent set default 6;

update public.app_settings
set commission_percent = 6, updated_at = now()
where id = 1;
