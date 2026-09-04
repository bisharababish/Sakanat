import type { TFunction } from 'i18next';

import type { BookingStatus, ListingStatus, OwnerStatus } from '@/src/types/database';

export function localizedName(
  item: { name_ar: string; name_en: string } | null | undefined,
  lang: string,
) {
  if (!item) return '';
  return lang.startsWith('ar') ? item.name_ar : item.name_en;
}

export function localizedTitle(
  item: { title_ar: string; title_en: string } | null | undefined,
  lang: string,
) {
  if (!item) return '';
  return lang.startsWith('ar') ? item.title_ar || item.title_en : item.title_en || item.title_ar;
}

export function localizedDescription(
  item: { description_ar: string; description_en: string } | null | undefined,
  lang: string,
) {
  if (!item) return '';
  return lang.startsWith('ar')
    ? item.description_ar || item.description_en
    : item.description_en || item.description_ar;
}

export function formatIls(amount: number, lang: string) {
  const value = new Intl.NumberFormat(lang.startsWith('ar') ? 'ar-PS' : 'en-PS').format(amount);
  return lang.startsWith('ar') ? `${value} ₪` : `₪${value}`;
}

export function ageFromDob(dob?: string | null, now = new Date()) {
  if (!dob) return null;
  const match = dob.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = now.getFullYear() - year;
  const reachedBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!reachedBirthday) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function ageLabel(dob: string | null | undefined, t: TFunction, now?: Date) {
  const age = ageFromDob(dob, now);
  if (age == null) return '';
  return t('profile.yearsOld', { count: age });
}

export function listingStatusLabel(status: ListingStatus, t: TFunction) {
  return t(`status.${status}`);
}

export function listingBadgeTone(status: ListingStatus) {
  if (status === 'approved') return 'approved' as const;
  if (status === 'rejected') return 'rejected' as const;
  if (status === 'hidden') return 'info' as const;
  return 'pending' as const;
}

export function ownerStatusLabel(status: OwnerStatus, t: TFunction) {
  return t(`status.${status}`);
}

export function bookingStatusLabel(status: BookingStatus, t: TFunction) {
  return t(`bookingStatus.${status}`);
}

export function bookingTone(status: BookingStatus) {
  if (status === 'confirmed' || status === 'completed') return 'approved' as const;
  if (status === 'cancelled') return 'rejected' as const;
  return 'pending' as const;
}

export function formatBookingDate(iso: string, lang: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(lang.startsWith('ar') ? 'ar' : 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
