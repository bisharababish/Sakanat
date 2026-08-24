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
