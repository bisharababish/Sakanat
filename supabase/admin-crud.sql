-- Admin can create/update/delete app data so they can fix mistakes.
-- Run once in the Supabase SQL editor.

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

drop policy if exists bookings_delete on public.bookings;
create policy bookings_delete on public.bookings
  for delete to authenticated
  using (public.is_admin());

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations
  for delete to authenticated
  using (public.is_admin());

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete to authenticated
  using (public.is_admin());

drop policy if exists saved_apartments_delete on public.saved_apartments;
create policy saved_apartments_delete on public.saved_apartments
  for delete to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists cities_admin_write on public.cities;
create policy cities_admin_write on public.cities
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists universities_admin_write on public.universities;
create policy universities_admin_write on public.universities
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
