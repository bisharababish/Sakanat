import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && key);

/** Public confirmation page after email verify. Also add this in Supabase Auth redirect URLs. */
export const AUTH_REDIRECT_URL = 'https://bisharababish.github.io/Sakanat/confirmed.html';
export const AUTH_RESET_URL = 'https://bisharababish.github.io/Sakanat/reset.html';

const memory = new Map<string, string>();
const canUseNativeStorage = typeof window !== 'undefined';

const authStorage: SupportedStorage = {
  getItem: async (storageKey) => {
    if (!canUseNativeStorage) return memory.get(storageKey) ?? null;
    return AsyncStorage.getItem(storageKey);
  },
  setItem: async (storageKey, value) => {
    if (!canUseNativeStorage) {
      memory.set(storageKey, value);
      return;
    }
    await AsyncStorage.setItem(storageKey, value);
  },
  removeItem: async (storageKey) => {
    if (!canUseNativeStorage) {
      memory.delete(storageKey);
      return;
    }
    await AsyncStorage.removeItem(storageKey);
  },
};

export function createDetachedClient() {
  const isolated = new Map<string, string>();
  return createClient(url || 'https://placeholder.supabase.co', key || 'public-anon-placeholder-key', {
    auth: {
      storage: {
        getItem: async (storageKey) => isolated.get(storageKey) ?? null,
        setItem: async (storageKey, value) => {
          isolated.set(storageKey, value);
        },
        removeItem: async (storageKey) => {
          isolated.delete(storageKey);
        },
      },
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'public-anon-placeholder-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: canUseNativeStorage,
      persistSession: canUseNativeStorage,
      detectSessionInUrl: false,
    },
  },
);
