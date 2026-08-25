-- Campus pins from the Google Maps places you sent (OSM campus + plus codes).
-- An-Najah is the old campus (Old Campus Street 7), not Al-Junaid.
-- Run in the Supabase SQL editor. Also copies pins onto existing apartments.

update public.universities u
set lat = v.lat, lng = v.lng
from (values
  ('birzeit', 31.96005, 35.182412),
  ('najah', 32.220141, 35.24427),
  ('alquds', 31.75509, 35.26107),
  ('aaup', 32.407379, 35.34369),
  ('bethlehem-uni', 31.710581, 35.201778),
  ('hebron-uni', 31.550262, 35.093412),
  ('ppu', 31.533628, 35.097976),
  ('ptuk', 32.313376, 35.022438),
  ('qou-ramallah', 31.920057, 35.207602),
  ('qou-nablus', 32.240153, 35.235398),
  ('qou-hebron', 31.543513, 35.084703),
  ('qou-bethlehem', 31.716088, 35.190516),
  ('qou-jenin', 32.466387, 35.293984),
  ('qou-tulkarm', 32.317562, 35.031641),
  ('istiqlal', 31.877345, 35.4569),
  ('dar-alkalima', 31.696979, 35.189354),
  ('ahliya', 31.695506, 35.187508),
  ('zaytuna', 32.077514, 35.216369)
) as v(slug, lat, lng)
where u.slug = v.slug;

-- Old apartments kept the pin from when they were saved. Copy the current campus pin.
update public.apartments a
set lat = u.lat, lng = u.lng
from public.universities u
where a.nearest_university_id = u.id;
