-- Admin audit log + review delete for moderation.
-- Run in Supabase SQL editor after student-trust.sql / admin-powers.sql.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_id uuid,
  note text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_admin_idx
  on public.admin_audit_log (admin_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_insert on public.admin_audit_log;
create policy admin_audit_insert on public.admin_audit_log
  for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

drop policy if exists admin_audit_read on public.admin_audit_log;
create policy admin_audit_read on public.admin_audit_log
  for select to authenticated
  using (public.is_admin());

drop policy if exists apartment_reviews_delete on public.apartment_reviews;
create policy apartment_reviews_delete on public.apartment_reviews
  for delete to authenticated
  using (public.is_admin());
