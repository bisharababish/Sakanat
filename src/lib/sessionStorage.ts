import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SupportedStorage } from '@supabase/supabase-js';

const CHUNK = 1800;
const memory = new Map<string, string>();
const native = Platform.OS === 'ios' || Platform.OS === 'android';

function countKey(key: string) {
  return `${key}__n`;
}

function chunkKey(key: string, index: number) {
  return `${key}__${index}`;
}

async function readSecure(key: string) {
  const countRaw = await SecureStore.getItemAsync(countKey(key));
  if (countRaw) {
    const count = Number(countRaw);
    if (!Number.isFinite(count) || count < 1) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      parts.push((await SecureStore.getItemAsync(chunkKey(key, i))) ?? '');
    }
    return parts.join('');
  }
  return SecureStore.getItemAsync(key);
}

async function writeSecure(key: string, value: string) {
  await deleteSecure(key);
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const count = Math.ceil(value.length / CHUNK);
  await SecureStore.setItemAsync(countKey(key), String(count));
  for (let i = 0; i < count; i += 1) {
    await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
}

async function deleteSecure(key: string) {
  const countRaw = await SecureStore.getItemAsync(countKey(key));
  const count = Number(countRaw);
  if (Number.isFinite(count) && count > 0) {
    await SecureStore.deleteItemAsync(countKey(key)).catch(() => undefined);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, i)).catch(() => undefined);
    }
  }
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

export const authStorage: SupportedStorage = {
  getItem: async (key) => {
    if (!native) {
      if (typeof window === 'undefined') return memory.get(key) ?? null;
      return AsyncStorage.getItem(key);
    }
    const secure = await readSecure(key);
    if (secure != null) return secure;
    const fallback = await AsyncStorage.getItem(key);
    if (fallback) {
      await writeSecure(key, fallback);
      await AsyncStorage.removeItem(key);
    }
    return fallback;
  },
  setItem: async (key, value) => {
    if (!native) {
      if (typeof window === 'undefined') {
        memory.set(key, value);
        return;
      }
      await AsyncStorage.setItem(key, value);
      return;
    }
    await writeSecure(key, value);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
  removeItem: async (key) => {
    if (!native) {
      if (typeof window === 'undefined') {
        memory.delete(key);
        return;
      }
      await AsyncStorage.removeItem(key);
      return;
    }
    await deleteSecure(key);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};
