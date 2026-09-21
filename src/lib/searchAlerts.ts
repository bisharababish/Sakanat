import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';

const KEY = 'sakanat.searchAlert';
const SEEN_KEY = 'sakanat.searchAlert.seen';
const OPS_KEY = 'sakanat.bookingOps.at';

export type SearchAlertPrefs = {
  enabled: boolean;
  universityId?: string;
  cityId?: string;
  maxPrice?: number | null;
  maxKm?: number | null;
  rooms?: string;
  baths?: string;
  amenities?: string[];
  gender?: string;
  query?: string;
  verifiedOnly?: boolean;
};

export async function loadSearchAlertPrefs(): Promise<SearchAlertPrefs> {
  try {
    const { data, error } = await supabase.rpc('get_search_alert');
    if (!error && Array.isArray(data) && data[0]) {
      const row = data[0] as {
        enabled: boolean;
        university_id?: string | null;
        city_id?: string | null;
        max_price?: number | null;
        max_km?: number | null;
        rooms?: string | null;
        baths?: string | null;
        amenities?: string[] | null;
        gender?: string | null;
        query?: string | null;
        verified_only?: boolean | null;
      };
      const prefs: SearchAlertPrefs = {
        enabled: Boolean(row.enabled),
        universityId: row.university_id || undefined,
        cityId: row.city_id || undefined,
        maxPrice: row.max_price != null ? Number(row.max_price) : null,
        maxKm: row.max_km != null ? Number(row.max_km) : null,
        rooms: row.rooms || undefined,
        baths: row.baths || undefined,
        amenities: row.amenities ?? [],
        gender: row.gender || undefined,
        query: row.query || undefined,
        verifiedOnly: Boolean(row.verified_only),
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
      return prefs;
    }
  } catch {
    // Fall back to local.
  }
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { enabled: false };
    return { enabled: false, ...JSON.parse(raw) } as SearchAlertPrefs;
  } catch {
    return { enabled: false };
  }
}

export async function saveSearchAlertPrefs(prefs: SearchAlertPrefs) {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  try {
    await supabase.rpc('upsert_search_alert', {
      p_enabled: Boolean(prefs.enabled),
      p_university_id: prefs.universityId || null,
      p_city_id: prefs.cityId || null,
      p_max_price: prefs.maxPrice ?? null,
      p_max_km: prefs.maxKm ?? null,
      p_rooms: prefs.rooms || null,
      p_baths: prefs.baths || null,
      p_amenities: prefs.amenities ?? [],
      p_gender: prefs.gender || null,
      p_query: prefs.query || null,
      p_verified_only: Boolean(prefs.verifiedOnly),
    });
  } catch {
    // Local prefs still work if SQL not applied yet.
  }
}

export async function syncSearchAlertOnLogin() {
  try {
    const prefs = await loadSearchAlertPrefs();
    if (prefs.enabled) {
      await saveSearchAlertPrefs(prefs);
    }
  } catch {
    // optional
  }
}

export async function loadSeenListingIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.slice(0, 400) : [];
  } catch {
    return [];
  }
}

export async function saveSeenListingIds(ids: string[]) {
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(0, 400)));
}

/** Throttled: auto-complete stays, pending SLA, review nudges (server). */
export async function maybeRunBookingOps() {
  try {
    const last = Number((await AsyncStorage.getItem(OPS_KEY)) || 0);
    if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    await AsyncStorage.setItem(OPS_KEY, String(Date.now()));
    await supabase.rpc('run_booking_ops');
  } catch {
    // Optional until product-ops.sql is applied.
  }
}

export async function runBookingOpsNow() {
  const { data, error } = await supabase.rpc('run_booking_ops');
  if (error) throw error;
  await AsyncStorage.setItem(OPS_KEY, String(Date.now()));
  return data as {
    reminded?: number;
    expired?: number;
    completed?: number;
    nudged?: number;
  };
}

export async function loadBookingOpsStatus() {
  const { data, error } = await supabase.rpc('booking_ops_status');
  if (error) throw error;
  return data as {
    cronScheduled?: boolean;
    lastAt?: string | null;
    lastResult?: Record<string, number> | null;
  };
}

/** Hours left before pending auto-expire (5 days). */
export function pendingExpireHoursLeft(createdAt: string, now = Date.now()) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  const expireAt = created + 5 * 24 * 60 * 60 * 1000;
  const left = Math.max(0, expireAt - now);
  return Math.ceil(left / (60 * 60 * 1000));
}

export function listingMatchesAlert(
  item: {
    city_id?: string | null;
    nearest_university_id?: string | null;
    price_month: number;
    rooms?: number | null;
    bathrooms?: number | null;
    amenities?: string[] | null;
    gender_policy?: string | null;
    title_ar?: string | null;
    title_en?: string | null;
    building_name?: string | null;
    profiles?: { id_verify_status?: string | null } | null;
  },
  prefs: SearchAlertPrefs,
  km?: number | null,
) {
  if (prefs.universityId && item.nearest_university_id !== prefs.universityId) return false;
  if (prefs.cityId && item.city_id !== prefs.cityId) return false;
  if (prefs.maxPrice != null && item.price_month > prefs.maxPrice) return false;
  if (prefs.maxKm != null && (km == null || km > prefs.maxKm)) return false;
  if (prefs.rooms === '4' && (item.rooms ?? 0) < 4) return false;
  if (prefs.rooms && prefs.rooms !== '4' && item.rooms !== Number(prefs.rooms)) return false;
  if (prefs.baths === '3' && (item.bathrooms ?? 0) < 3) return false;
  if (prefs.baths && prefs.baths !== '3' && item.bathrooms !== Number(prefs.baths)) return false;
  if (prefs.amenities?.length) {
    const have = new Set(item.amenities ?? []);
    if (!prefs.amenities.every((key) => have.has(key))) return false;
  }
  if (prefs.gender && prefs.gender !== 'all' && prefs.gender !== 'suitable') {
    if (item.gender_policy !== 'any' && item.gender_policy !== prefs.gender) return false;
  }
  const needle = (prefs.query ?? '').trim().toLowerCase();
  if (needle) {
    const hay = [item.title_ar, item.title_en, item.building_name].join(' ').toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}
