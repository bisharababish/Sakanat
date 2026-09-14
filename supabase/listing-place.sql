-- Building / floor / unit on listings so owners can group many apartments
-- and students know exactly where they are going.
-- Run in the Supabase SQL editor.

alter table public.apartments
  add column if not exists building_name text;

alter table public.apartments
  add column if not exists floor smallint;

alter table public.apartments
  add column if not exists unit_number text;

comment on column public.apartments.building_name is 'Shared building name; same value groups units together.';
comment on column public.apartments.floor is '0 = ground, negative = basement, positive = floor number.';
comment on column public.apartments.unit_number is 'Door / apartment number inside the building (e.g. 12B).';

create index if not exists apartments_owner_building_idx
  on public.apartments (owner_id, building_name);
