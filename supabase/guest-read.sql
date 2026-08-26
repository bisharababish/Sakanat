-- Allow guests to view approved listings only. Owners still see their own drafts when logged in.
drop policy if exists apartments_read_anon on public.apartments;
create policy apartments_read_anon on public.apartments
  for select to anon
  using (status = 'approved');
