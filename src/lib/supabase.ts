import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { authStorage } from '@/src/lib/sessionStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && key);

/** Public confirmation page after email verify. Also add this in Supabase Auth redirect URLs. */
export const AUTH_REDIRECT_URL = 'https://bisharababish.github.io/Sakanat/confirmed.html';
export const AUTH_RESET_URL = 'https://bisharababish.github.io/Sakanat/reset.html';

const canUseNativeStorage = typeof window !== 'undefined';

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

export function uniqueChannel(name: string) {
  return supabase.channel(`${name}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
}
