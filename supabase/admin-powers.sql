-- Run once so admin can delete listings.

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists apartments_delete on public.apartments;
create policy apartments_delete on public.apartments
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());
