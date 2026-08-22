import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ar from '@/src/i18n/ar.json';
import en from '@/src/i18n/en.json';

export const LANGUAGE_KEY = 'sakanat.language';

function deviceLanguage() {
  const locales = Localization.getLocales();
  const code = locales[0]?.languageCode ?? 'ar';
  return code.startsWith('en') ? 'en' : 'ar';
}

export async function loadSavedLanguage() {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (saved === 'ar' || saved === 'en') return saved;
  return deviceLanguage();
}

export function applyRtl(language: string) {
  const isRtl = language.startsWith('ar');
  I18nManager.allowRTL(isRtl);
  if (I18nManager.isRTL !== isRtl) {
    I18nManager.forceRTL(isRtl);
  }
}

export async function changeAppLanguage(language: 'ar' | 'en') {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  applyRtl(language);
  await i18n.changeLanguage(language);
}

void i18n.use(initReactI18next).init({
  lng: 'ar',
  fallbackLng: 'ar',
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
