import type { TFunction } from 'i18next';

export function seekerRoleLabel(role: string | null | undefined, t: TFunction) {
  return role === 'renter' ? t('roles.renter') : t('roles.student');
}

export function seekerIcon(role: string | null | undefined) {
  return role === 'renter' ? ('briefcase' as const) : ('school' as const);
}

export function seekerExtraIcon(role: string | null | undefined) {
  return role === 'renter' ? ('location-outline' as const) : ('school-outline' as const);
}

export function seekerMessageKey(role: string | null | undefined) {
  return role === 'renter' ? 'booking.messageRenter' : 'booking.messageStudent';
}
