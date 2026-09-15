import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import i18n from '@/src/i18n';
import { alert } from '@/src/lib/notice';
import { homeHref } from '@/src/lib/routes';
import type { UserRole } from '@/src/types/database';

const PENDING_APT = 'sakanat.guest.apartment';

let pendingApartmentId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

function emit(id: string | null) {
  pendingApartmentId = id;
  listeners.forEach((fn) => fn(id));
}

export function rememberGuestApartment(id: string) {
  if (!id) return;
  emit(id);
  void AsyncStorage.setItem(PENDING_APT, id);
}

export function takeGuestApartment() {
  const id = pendingApartmentId;
  emit(null);
  void AsyncStorage.removeItem(PENDING_APT);
  return id;
}

export function peekGuestApartment() {
  return pendingApartmentId;
}

export function subscribeGuestApartment(fn: (id: string | null) => void) {
  listeners.add(fn);
  fn(pendingApartmentId);
  return () => {
    listeners.delete(fn);
  };
}

export async function hydrateGuestApartment() {
  const stored = await AsyncStorage.getItem(PENDING_APT);
  if (stored) emit(stored);
  return stored;
}

export function openWelcome() {
  router.push('/(auth)/welcome');
}

export function openLogin() {
  router.push('/(auth)/login');
}

export function openRegister() {
  router.push('/(auth)/register');
}

export function requireAccount(apartmentId?: string) {
  if (apartmentId) rememberGuestApartment(apartmentId);
  alert(i18n.t('guest.needAccount'), i18n.t('guest.needAccountBody'), [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: i18n.t('auth.login'), onPress: openLogin },
    { text: i18n.t('auth.register'), onPress: openRegister },
  ]);
}

export function apartmentPath(signedIn: boolean) {
  return signedIn ? ('/(student)/apartment/[id]' as const) : ('/(guest)/apartment/[id]' as const);
}

export function seekerHomeOrListing(role: UserRole) {
  const id = peekGuestApartment();
  if (id && (role === 'student' || role === 'renter')) {
    return { pathname: '/(student)/apartment/[id]' as const, params: { id } };
  }
  return homeHref(role);
}
