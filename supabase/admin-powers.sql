-- Historical bootstrap. Prefer owner-listing-gates.sql + lockdown.sql.
-- Kept MFA-safe so re-running does not strip AAL2.

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated
  with check (public.is_admin() or (owner_id = auth.uid() and public.jwt_aal2()));

drop policy if exists apartments_delete on public.apartments;
create policy apartments_delete on public.apartments
  for delete to authenticated
  using (public.is_admin() or (owner_id = auth.uid() and public.jwt_aal2()));
