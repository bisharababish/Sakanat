import AsyncStorage from '@react-native-async-storage/async-storage';

import { assertRateLimit } from '@/src/lib/rateLimit';

const FAIL_KEY = 'sakanat.auth.fails';
const LOCK_KEY = 'sakanat.auth.lockUntil';
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

export const AUTH_PACE = {
  signupMs: 20_000,
  resetMs: 30_000,
  resendMs: 30_000,
  verifyMs: 3_000,
} as const;

function lockedError() {
  const err = new Error('rate limit');
  (err as { code?: string }).code = 'over_request_rate_limit';
  return err;
}

export async function assertAuthOpen() {
  const until = Number((await AsyncStorage.getItem(LOCK_KEY)) || 0);
  if (until > Date.now()) throw lockedError();
}

export async function recordAuthFailure() {
  const fails = Number((await AsyncStorage.getItem(FAIL_KEY)) || 0) + 1;
  if (fails >= MAX_FAILS) {
    await AsyncStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS));
    await AsyncStorage.setItem(FAIL_KEY, '0');
    throw lockedError();
  }
  await AsyncStorage.setItem(FAIL_KEY, String(fails));
}

export async function clearAuthFailures() {
  await AsyncStorage.multiRemove([FAIL_KEY, LOCK_KEY]);
}

export async function paceAuth(key: string, minIntervalMs: number) {
  if (!(await assertRateLimit(`auth:${key}`, minIntervalMs))) throw lockedError();
}
