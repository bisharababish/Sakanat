/** Listing quality rules for owner publish / admin review. */
export const LISTING_MIN_PHOTOS = 3;
export const LISTING_MIN_DESC = 40;
export const LISTING_MIN_AMENITIES = 1;

export type ListingQualityInput = {
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  cityId?: string;
  price?: string | number;
  photos?: string[];
  amenities?: string[];
  universityId?: string | null;
  campusKm?: string | number | null;
};

export type ListingQualityIssue =
  | 'photos'
  | 'description'
  | 'amenities'
  | 'title'
  | 'city'
  | 'price'
  | 'campus';

export function listingQualityIssues(input: ListingQualityInput): ListingQualityIssue[] {
  const issues: ListingQualityIssue[] = [];
  if (!(input.titleAr ?? '').trim()) issues.push('title');
  if (!input.cityId) issues.push('city');
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) issues.push('price');
  if ((input.photos?.length ?? 0) < LISTING_MIN_PHOTOS) issues.push('photos');
  const desc = (input.descriptionAr || input.descriptionEn || '').trim();
  if (desc.length < LISTING_MIN_DESC) issues.push('description');
  if ((input.amenities?.length ?? 0) < LISTING_MIN_AMENITIES) issues.push('amenities');
  if (input.universityId && (input.campusKm === '' || input.campusKm == null || Number.isNaN(Number(input.campusKm)))) {
    issues.push('campus');
  }
  return issues;
}

export const LISTING_REJECT_PRESETS = [
  'rejectPhotos',
  'rejectDescription',
  'rejectLocation',
  'rejectPrice',
  'rejectDuplicate',
  'rejectOther',
] as const;

export type ListingRejectPreset = (typeof LISTING_REJECT_PRESETS)[number];
