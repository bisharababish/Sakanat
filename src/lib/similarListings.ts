import { haversineKm } from '@/src/lib/distance';
import type { Apartment } from '@/src/types/database';

/** Nearby / same-campus approved listings for “similar” suggestions. */
export function similarNearCampus(
  current: Apartment,
  pool: Apartment[],
  limit = 6,
): Apartment[] {
  const others = pool.filter(
    (item) => item.id !== current.id && item.status === 'approved' && item.lat && item.lng,
  );

  const scored = others.map((item) => {
    let score = 0;
    if (current.nearest_university_id && item.nearest_university_id === current.nearest_university_id) {
      score += 100;
    }
    if (current.city_id && item.city_id === current.city_id) score += 40;
    if (current.gender_policy && item.gender_policy === current.gender_policy) score += 15;
    if (current.lat && current.lng && item.lat && item.lng) {
      const km = haversineKm(current, item);
      score += Math.max(0, 30 - km * 3);
    }
    const priceGap = Math.abs(Number(item.price_month) - Number(current.price_month));
    score += Math.max(0, 20 - priceGap / 100);
    return { item, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}
