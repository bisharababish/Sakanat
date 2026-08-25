import type { Apartment, University } from '@/src/types/database';

const EARTH_KM = 6371;
export const UNDER_ONE_KM = 0.5;
export const CAMPUS_KM_VALUES = [UNDER_ONE_KM, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function campusKmChipValue(km: number | null | undefined) {
  if (km == null || Number.isNaN(Number(km))) return '';
  if (km < 1) return String(UNDER_ONE_KM);
  return String(Math.min(10, Math.max(1, Math.round(km))));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function listingDistanceKm(apartment: Apartment, university?: University | null) {
  if (university?.lat && university?.lng && apartment.lat && apartment.lng) {
    const computed = haversineKm(apartment, university);
    if (computed >= 0.15) return Number(computed.toFixed(1));
  }
  if (!university) return apartment.campus_distance_km;
  if (apartment.nearest_university_id === university.id && apartment.campus_distance_km != null) {
    return apartment.campus_distance_km;
  }
  return apartment.campus_distance_km;
}

export function formatKm(km: number | null | undefined, locale: 'ar' | 'en') {
  if (km == null || Number.isNaN(km)) return locale === 'ar' ? 'المسافة غير محددة' : 'Distance unknown';
  if (km < 1) return locale === 'ar' ? 'أقل من 1 كم عن الجامعة' : 'Less than 1 km from campus';
  const value = Math.abs(km - Math.round(km)) < 0.05 ? String(Math.round(km)) : km.toFixed(1);
  return locale === 'ar' ? `${value} كم عن الجامعة` : `${value} km from campus`;
}

export function mapsUrl(lat: number, lng: number, label?: string) {
  const q = encodeURIComponent(label || `${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${q}`;
}
