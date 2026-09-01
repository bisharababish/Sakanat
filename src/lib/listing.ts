import { supabase } from '@/src/lib/supabase';
import type { Apartment, ListingStatus } from '@/src/types/database';

export function apartmentWriteFields(apartment: Apartment, status: ListingStatus = 'pending') {
  return {
    owner_id: apartment.owner_id,
    city_id: apartment.city_id,
    nearest_university_id: apartment.nearest_university_id,
    title_ar: apartment.title_ar,
    title_en: apartment.title_en,
    description_ar: apartment.description_ar,
    description_en: apartment.description_en,
    price_month: apartment.price_month,
    rooms: apartment.rooms,
    bathrooms: apartment.bathrooms,
    area_m2: apartment.area_m2,
    gender_policy: apartment.gender_policy,
    amenities: apartment.amenities ?? [],
    photos: apartment.photos ?? [],
    lat: apartment.lat,
    lng: apartment.lng,
    campus_distance_km: apartment.campus_distance_km,
    status,
  };
}

export async function updateListingStatus(
  id: string,
  status: ListingStatus,
  rejectReason?: string | null,
) {
  return supabase
    .from('apartments')
    .update({
      status,
      reject_reason: status === 'rejected' ? rejectReason?.trim() || null : null,
    })
    .eq('id', id);
}

export function copyListingTitles(apartment: Apartment, suffix: string) {
  const mark = suffix.trim();
  const withMark = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return mark;
    if (trimmed.endsWith(mark)) return trimmed;
    return `${trimmed} ${mark}`;
  };
  return {
    title_ar: withMark(apartment.title_ar),
    title_en: withMark(apartment.title_en || apartment.title_ar),
  };
}
