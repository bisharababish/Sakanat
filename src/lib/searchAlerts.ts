import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sakanat.searchAlert';
const SEEN_KEY = 'sakanat.searchAlert.seen';

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
