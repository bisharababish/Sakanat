import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { whatsappLink } from '@/src/lib/phone';

export const SUPPORT_EMAIL = 'bishara.babish@gmail.com';
export const ANDROID_PACKAGE = 'ps.sakanat.app';

export function appVersion() {
  return Constants.expoConfig?.version ?? '1.0.0';
}

export function mailTo(subject: string, body?: string) {
  const query = new URLSearchParams({ subject, ...(body ? { body } : {}) }).toString();
  return `mailto:${SUPPORT_EMAIL}?${query}`;
}

function digits(raw: string) {
  return raw.replace(/\D/g, '');
}

export function supportWhatsApp() {
  return digits(process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '');
}

export function supportWhatsAppUrl(text: string) {
  const phone = supportWhatsApp();
  if (!phone) return null;
  return `${whatsappLink(`+${phone}`)}?text=${encodeURIComponent(text)}`;
}

export function rateUrl() {
  if (Platform.OS === 'android') {
    return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  }
  const appleId = (process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ?? '').trim();
  if (appleId) return `https://apps.apple.com/app/id${appleId}`;
  return null;
}
