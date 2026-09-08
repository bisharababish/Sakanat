import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'sakanat.rate.';

/** Returns true if the action is allowed; false if still cooling down. */
export async function assertRateLimit(key: string, minIntervalMs: number) {
  const storageKey = `${PREFIX}${key}`;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    const last = raw ? Number(raw) : 0;
    const now = Date.now();
    if (last && now - last < minIntervalMs) return false;
    await AsyncStorage.setItem(storageKey, String(now));
    return true;
  } catch {
    return true;
  }
}

export function rateLimitMessage(code: string, t: (key: string) => string) {
  if (/RATE_REPORT/i.test(code)) return t('limits.report');
  if (/RATE_MESSAGE/i.test(code)) return t('limits.message');
  if (/RATE_BOOKING/i.test(code)) return t('limits.booking');
  if (/rate|too many/i.test(code)) return t('limits.generic');
  return '';
}

export const RATE = {
  reportMs: 60_000,
  messageMs: 1200,
  bookingMs: 30_000,
} as const;
