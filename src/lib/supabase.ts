import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && key);

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
