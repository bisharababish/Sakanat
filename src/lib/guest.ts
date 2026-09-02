import { router } from 'expo-router';

import i18n from '@/src/i18n';
import { alert } from '@/src/lib/notice';

export function openWelcome() {
  router.push('/(auth)/welcome');
}

export function requireAccount() {
  alert(i18n.t('guest.needAccount'), i18n.t('guest.needAccountBody'), [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: i18n.t('auth.login'), onPress: openWelcome },
    { text: i18n.t('auth.register'), onPress: () => router.push('/(auth)/register') },
  ]);
}

export function apartmentPath(signedIn: boolean) {
  return signedIn ? ('/(student)/apartment/[id]' as const) : ('/(guest)/apartment/[id]' as const);
}
