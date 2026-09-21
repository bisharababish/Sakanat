import { listingDistanceKm } from '@/src/lib/distance';
import { localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { isoDateOnly, loadOccupiedStays, occupiedOverlap } from '@/src/lib/booking';
import { attachListingOwnerCards } from '@/src/lib/ownerPublic';
import { supabase } from '@/src/lib/supabase';
import type { Amenity, Apartment, GenderPolicy, University } from '@/src/types/database';

export type SearchSort = 'price' | 'distance' | 'rating';

export type SearchFilters = {
  cityId?: string;
  universityId?: string;
  maxPrice?: number | null;
  gender?: 'suitable' | 'all' | GenderPolicy;
  profileGender?: 'male' | 'female' | null;
  rooms?: string;
  bathrooms?: string;
  amenities?: Amenity[];
  query?: string;
  maxKm?: number | null;
  sort?: SearchSort;
  university?: University | null;
  lang?: string;
  isRenter?: boolean;
  verifiedOnly?: boolean;
  moveIn?: string | null;
  leaseMonths?: number | null;
  minRooms?: number | null;
};

/** Map group size to a rooms floor (2 people can share one room). */
export function roomsFilterFromOccupants(occupants?: number | null) {
  const n = Math.round(Number(occupants));
  if (!Number.isFinite(n) || n < 3) return 0;
  return Math.min(4, Math.ceil(n / 2));
}

/** Server filters what Postgres can do; distance/text refined on the client. */
export async function fetchApprovedListings(filters: SearchFilters = {}) {
  let query = supabase
    .from('apartments')
    .select('*, cities(*), universities(*)')
    .eq('status', 'approved');

  if (filters.cityId) query = query.eq('city_id', filters.cityId);
  if (filters.universityId) query = query.eq('nearest_university_id', filters.universityId);
  if (filters.maxPrice != null && Number.isFinite(filters.maxPrice)) {
    query = query.lte('price_month', filters.maxPrice);
  }
  if (filters.rooms === '4') query = query.gte('rooms', 4);
  else if (filters.rooms) query = query.eq('rooms', Number(filters.rooms));
  else if (filters.minRooms && filters.minRooms > 0) query = query.gte('rooms', filters.minRooms);
  if (filters.bathrooms === '3') query = query.gte('bathrooms', 3);
  else if (filters.bathrooms) query = query.eq('bathrooms', Number(filters.bathrooms));

  if (filters.gender && filters.gender !== 'all') {
    if (filters.gender === 'suitable' && filters.profileGender) {
      query = query.in('gender_policy', ['any', filters.profileGender]);
    } else if (filters.gender === 'male' || filters.gender === 'female') {
      query = query.eq('gender_policy', filters.gender);
    }
  }

  if (filters.amenities && filters.amenities.length > 0) {
    query = query.contains('amenities', filters.amenities);
  }

  if (filters.sort === 'rating') {
    query = query.order('review_avg', { ascending: false, nullsFirst: false }).order('price_month');
  } else {
    query = query.order('price_month');
  }

  const { data, error } = await query.limit(filters.cityId || filters.universityId ? 400 : 1000);
  if (error) throw error;
  let rows = (data as Apartment[]) ?? [];
  try {
    rows = await attachListingOwnerCards(rows);
  } catch {
    // Cards are optional; listings still show.
  }
  try {
    const occupied = await loadOccupiedStays();
    if (occupied.length) {
      const start = filters.moveIn || isoDateOnly();
      const months = Math.max(1, Number(filters.leaseMonths) || 1);
      rows = rows.filter(
        (item) =>
          !occupiedOverlap(
            { start_date: start, months },
            occupied.filter((stay) => stay.apartment_id === item.id),
          ),
      );
    }
  } catch {
    // Occupancy RPC is optional; search still works.
  }
  return refineListings(rows, filters);
}

export function refineListings(apartments: Apartment[], filters: SearchFilters) {
  const needle = (filters.query ?? '').trim().toLowerCase();
  const uni = filters.university ?? null;
  const lang = filters.lang ?? 'en';

  let rows = apartments.map((item) => ({
    item,
    distance: listingDistanceKm(item, uni, uni ? null : item.cities),
  }));

  if (filters.maxKm != null && Number.isFinite(filters.maxKm)) {
    rows = rows.filter((entry) => entry.distance == null || entry.distance <= Number(filters.maxKm));
  }

  if (filters.verifiedOnly) {
    rows = rows.filter((entry) => entry.item.profiles?.id_verify_status === 'approved');
  }

  if (needle) {
    rows = rows.filter((entry) => {
      const haystack = [
        localizedTitle(entry.item, lang),
        localizedDescription(entry.item, lang),
        localizedName(entry.item.cities, lang),
        entry.item.building_name,
        entry.item.unit_number,
        ...(filters.isRenter ? [] : [localizedName(entry.item.universities, lang)]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  const sort = filters.sort ?? 'price';
  rows.sort((a, b) => {
    if (sort === 'distance') return (a.distance ?? 999) - (b.distance ?? 999);
    if (sort === 'rating') {
      const aAvg = a.item.review_avg ?? 0;
      const bAvg = b.item.review_avg ?? 0;
      if (bAvg !== aAvg) return bAvg - aAvg;
      const aCount = a.item.review_count ?? 0;
      const bCount = b.item.review_count ?? 0;
      if (bCount !== aCount) return bCount - aCount;
      return a.item.price_month - b.item.price_month;
    }
    return a.item.price_month - b.item.price_month;
  });

  return rows;
}
