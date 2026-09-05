-- Private ID docs + admin verification status.
-- Run in Supabase SQL editor after student-trust.sql.
--
-- Storage: private bucket `id-docs` at paths {userId}/national.jpg | university.jpg
-- Profile columns store the storage path (not a public URL).

alter table public.profiles
  add column if not exists id_verify_status text not null default 'none';

alter table public.profiles
  drop constraint if exists profiles_id_verify_status_check;

alter table public.profiles
  add constraint profiles_id_verify_status_check
  check (id_verify_status in ('none', 'pending', 'approved', 'rejected'));

alter table public.profiles
  add column if not exists id_verify_note text;

alter table public.profiles
  add column if not exists id_verified_at timestamptz;

alter table public.profiles
  add column if not exists id_verified_by uuid references public.profiles(id) on delete set null;

create index if not exists profiles_id_verify_pending_idx
  on public.profiles (id_verify_status)
  where id_verify_status = 'pending';

-- Mark existing uploaded docs as pending review (once).
update public.profiles
set id_verify_status = 'pending'
where id_verify_status = 'none'
  and national_id_url is not null
  and (
    role = 'renter'
    or university_card_url is not null
  );

-- ---------------------------------------------------------------------------
-- Protect verification fields (students may only move status → pending)
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.account_status := old.account_status;
    if old.role = 'owner' and new.owner_status is distinct from old.owner_status then
      new.owner_status := old.owner_status;
    end if;

    if new.id_verify_status is distinct from old.id_verify_status then
      if new.id_verify_status = 'pending' then
        new.id_verify_note := null;
        new.id_verified_at := null;
        new.id_verified_by := null;
      else
        new.id_verify_status := old.id_verify_status;
        new.id_verify_note := old.id_verify_note;
        new.id_verified_at := old.id_verified_at;
        new.id_verified_by := old.id_verified_by;
      end if;
    else
      new.id_verify_note := old.id_verify_note;
      new.id_verified_at := old.id_verified_at;
      new.id_verified_by := old.id_verified_by;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tighter profile reads: self, admin, booking/chat party, or approved listing owner
-- ---------------------------------------------------------------------------
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.bookings b
      where (b.student_id = profiles.id and b.owner_id = auth.uid())
         or (b.owner_id = profiles.id and b.student_id = auth.uid())
    )
    or exists (
      select 1 from public.conversations c
      where (c.student_id = profiles.id and c.owner_id = auth.uid())
         or (c.owner_id = profiles.id and c.student_id = auth.uid())
    )
    or exists (
      select 1 from public.apartments a
      where a.owner_id = profiles.id
        and a.status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
-- Private ID storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('id-docs', 'id-docs', false)
on conflict (id) do update set public = false;

drop policy if exists id_docs_read on storage.objects;
create policy id_docs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'id-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.bookings b
        where b.owner_id = auth.uid()
          and b.student_id::text = (storage.foldername(name))[1]
      )
    )
  );

drop policy if exists id_docs_insert on storage.objects;
create policy id_docs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'id-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists id_docs_update on storage.objects;
create policy id_docs_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'id-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  )
  with check (
    bucket_id = 'id-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists id_docs_delete on storage.objects;
create policy id_docs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'id-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
