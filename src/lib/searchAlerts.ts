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
};

export async function loadSearchAlertPrefs(): Promise<SearchAlertPrefs> {
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
    });
  } catch {
    // Local prefs still work if SQL not applied yet.
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
