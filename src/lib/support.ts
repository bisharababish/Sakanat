import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { whatsappLink } from '@/src/lib/phone';

export const SUPPORT_EMAIL = 'sakanatappatinfo@gmail.com';
export const TRUST_EMAIL = (process.env.EXPO_PUBLIC_TRUST_EMAIL ?? '').trim() || SUPPORT_EMAIL;
export const SUPPORT_PHONE = '+972594295100';
export const ANDROID_PACKAGE = 'ps.sakanat.app';
export const INSTAGRAM_HANDLE = 'matra7.ps';
export const COPYRIGHT_YEAR = 2026;

export function instagramUrl() {
  return `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
}

export function appVersion() {
  return Constants.expoConfig?.version ?? '1.0.0';
}

export function mailTo(subject: string, body?: string, email = SUPPORT_EMAIL) {
  const query = new URLSearchParams({ subject, ...(body ? { body } : {}) }).toString();
  return `mailto:${email}?${query}`;
}

function digits(raw: string) {
  return raw.replace(/\D/g, '');
}

export function supportWhatsApp() {
  const fromEnv = digits(process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '');
  return fromEnv || digits(SUPPORT_PHONE);
}

export function supportWhatsAppUrl(text: string) {
  const phone = supportWhatsApp();
  if (!phone) return null;
  return `${whatsappLink(`+${phone}`)}?text=${encodeURIComponent(text)}`;
}

export function rateUrl() {
  // Soft launch: only show Rate when the store page is actually live.
  if (Platform.OS === 'android') {
    const live = (process.env.EXPO_PUBLIC_ANDROID_PLAY_LIVE ?? '').trim() === '1';
    if (!live) return null;
    return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  }
  const appleId = (process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? '').trim();
  if (appleId) return `https://apps.apple.com/app/id${appleId}`;
  return null;
}
