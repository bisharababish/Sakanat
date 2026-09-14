import type { TFunction } from 'i18next';

import { stayEndDate } from '@/src/lib/booking';
import { localizedTitle } from '@/src/lib/format';
import { displayName } from '@/src/lib/name';
import { supabase } from '@/src/lib/supabase';
import type { Apartment, BookingStatus } from '@/src/types/database';

export type PlaceFields = {
  building_name?: string | null;
  floor?: number | null;
  unit_number?: string | null;
};

export function buildingKey(item: PlaceFields & { id?: string }) {
  const name = (item.building_name ?? '').trim().toLowerCase();
  if (name) return `b:${name}`;
  return `u:${item.id ?? 'none'}`;
}

export function buildingTitle(
  item: PlaceFields & { title_ar?: string | null; title_en?: string | null; id?: string },
  lang: string,
  fallback: string,
) {
  const name = (item.building_name ?? '').trim();
  if (name) return name;
  return localizedTitle(item, lang) || fallback;
}

export function floorLabel(floor: number | null | undefined, t: TFunction) {
  if (floor == null || Number.isNaN(Number(floor))) return '';
  const n = Number(floor);
  if (n < 0) return t('owner.floorBasement');
  if (n === 0) return t('owner.floorGround');
  return t('owner.floorN', { n });
}

export function unitLabel(unit: string | null | undefined, t: TFunction) {
  const value = (unit ?? '').trim();
  if (!value) return '';
  return t('owner.unitN', { n: value });
}

export function listingPlaceLine(
  item: PlaceFields | null | undefined,
  t: TFunction,
  opts?: { skipBuilding?: boolean },
) {
  if (!item) return '';
  const parts = [
    opts?.skipBuilding ? '' : (item.building_name ?? '').trim(),
    floorLabel(item.floor, t),
    unitLabel(item.unit_number, t),
  ].filter(Boolean);
  return parts.join(' · ');
}

export function listingPlacePayload(buildingName: string, floor: string, unitNumber: string) {
  const floorN = floor.trim() === '' ? null : Number(floor);
  return {
    building_name: buildingName.trim() || null,
    floor: floorN == null || Number.isNaN(floorN) ? null : floorN,
    unit_number: unitNumber.trim() || null,
  };
}

export function isListingPlaceSqlMissing(message: string) {
  return /building_name|unit_number/i.test(message) || (/\bfloor\b/i.test(message) && /column/i.test(message));
}

export function compareListingPlace(
  a: PlaceFields & { title_ar?: string | null; title_en?: string | null },
  b: PlaceFields & { title_ar?: string | null; title_en?: string | null },
  lang: string,
) {
  const ba = (a.building_name ?? '').trim().toLowerCase();
  const bb = (b.building_name ?? '').trim().toLowerCase();
  if (ba !== bb) return ba.localeCompare(bb, lang.startsWith('ar') ? 'ar' : 'en');
  const fa = a.floor ?? 999;
  const fb = b.floor ?? 999;
  if (fa !== fb) return fa - fb;
  return (a.unit_number ?? '').localeCompare(b.unit_number ?? '', lang.startsWith('ar') ? 'ar' : 'en');
}

export function uniqueBuildings(
  items: (PlaceFields & { title_ar?: string | null; title_en?: string | null; id?: string })[],
  lang: string,
  untitled: string,
) {
  const seen = new Map<string, { key: string; name: string; count: number }>();
  for (const item of items) {
    const key = buildingKey(item);
    const current = seen.get(key);
    if (current) {
      current.count += 1;
    } else {
      seen.set(key, { key, name: buildingTitle(item, lang, untitled), count: 1 });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, lang.startsWith('ar') ? 'ar' : 'en'));
}

export type OccupancyStay = {
  bookingId: string;
  apartmentId: string;
  studentId: string;
  status: Extract<BookingStatus, 'pending' | 'confirmed'>;
  occupants: number;
  startDate: string;
  months: number;
  name: string;
  avatarUrl: string | null;
};

export type OccupancyUnit = {
  apartment: Apartment;
  stays: OccupancyStay[];
};

export type OccupancyBuilding = {
  key: string;
  name: string;
  units: OccupancyUnit[];
  people: number;
  pending: number;
  vacant: number;
};

export async function loadOwnerOccupancy(ownerId: string, lang: string, untitled: string) {
  const [{ data: listings }, { data: bookings }] = await Promise.all([
    supabase.from('apartments').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select(
        'id, apartment_id, student_id, status, occupants, start_date, months, profiles!student_id(id, full_name, full_name_en, avatar_url)',
      )
      .eq('owner_id', ownerId)
      .in('status', ['pending', 'confirmed']),
  ]);

  const apartments = (listings as Apartment[]) ?? [];
  const staysByApt = new Map<string, OccupancyStay[]>();
  for (const row of (bookings as {
    id: string;
    apartment_id: string;
    student_id: string;
    status: 'pending' | 'confirmed';
    occupants: number;
    start_date: string;
    months: number;
    profiles?:
      | { id: string; full_name?: string | null; full_name_en?: string | null; avatar_url?: string | null }
      | { id: string; full_name?: string | null; full_name_en?: string | null; avatar_url?: string | null }[]
      | null;
  }[]) ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const stay: OccupancyStay = {
      bookingId: row.id,
      apartmentId: row.apartment_id,
      studentId: row.student_id,
      status: row.status,
      occupants: row.occupants ?? 1,
      startDate: row.start_date,
      months: row.months,
      name: displayName(profile, lang) || '',
      avatarUrl: profile?.avatar_url ?? null,
    };
    const list = staysByApt.get(row.apartment_id) ?? [];
    list.push(stay);
    staysByApt.set(row.apartment_id, list);
  }

  const groups = new Map<string, OccupancyBuilding>();
  for (const apartment of apartments) {
    const key = buildingKey(apartment);
    const current = groups.get(key) ?? {
      key,
      name: buildingTitle(apartment, lang, untitled),
      units: [],
      people: 0,
      pending: 0,
      vacant: 0,
    };
    const stays = staysByApt.get(apartment.id) ?? [];
    const confirmed = stays.filter((item) => item.status === 'confirmed');
    const pending = stays.filter((item) => item.status === 'pending');
    current.units.push({ apartment, stays });
    current.people += confirmed.reduce((sum, item) => sum + item.occupants, 0);
    current.pending += pending.length;
    if (confirmed.length === 0 && pending.length === 0) current.vacant += 1;
    groups.set(key, current);
  }

  const buildings = [...groups.values()].map((group) => ({
    ...group,
    units: [...group.units].sort((a, b) => compareListingPlace(a.apartment, b.apartment, lang)),
  }));
  buildings.sort((a, b) => a.name.localeCompare(b.name, lang.startsWith('ar') ? 'ar' : 'en'));
  return buildings;
}

export function occupancyTotals(buildings: OccupancyBuilding[]) {
  return buildings.reduce(
    (sum, item) => ({
      buildings: sum.buildings + 1,
      units: sum.units + item.units.length,
      people: sum.people + item.people,
      pending: sum.pending + item.pending,
      vacant: sum.vacant + item.vacant,
    }),
    { buildings: 0, units: 0, people: 0, pending: 0, vacant: 0 },
  );
}

function startOfDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(target: Date, today: Date) {
  return Math.round((startOfDay(target) - startOfDay(today)) / 86400000);
}

export const ARRIVE_WINDOW_DAYS = 7;
export const LEAVE_WINDOW_DAYS = 14;

export type OccupancyMove = OccupancyStay & {
  kind: 'arrive' | 'leave';
  days: number;
  buildingName: string;
  place: string;
};

export function occupancyMoves(buildings: OccupancyBuilding[], today: Date, t: TFunction): OccupancyMove[] {
  const moves: OccupancyMove[] = [];
  for (const building of buildings) {
    for (const unit of building.units) {
      const place = listingPlaceLine(unit.apartment, t, { skipBuilding: true });
      for (const stay of unit.stays) {
        const start = new Date(`${stay.startDate}T00:00:00`);
        if (Number.isNaN(start.getTime())) continue;
        const toStart = daysUntil(start, today);
        if (toStart >= 0 && toStart <= ARRIVE_WINDOW_DAYS) {
          moves.push({ ...stay, kind: 'arrive', days: toStart, buildingName: building.name, place });
        }
        if (stay.status !== 'confirmed') continue;
        const end = stayEndDate({ start_date: stay.startDate, months: stay.months });
        const toEnd = daysUntil(end, today);
        if (toEnd >= 0 && toEnd <= LEAVE_WINDOW_DAYS) {
          moves.push({ ...stay, kind: 'leave', days: toEnd, buildingName: building.name, place });
        }
      }
    }
  }
  return moves.sort((a, b) => a.days - b.days || a.kind.localeCompare(b.kind));
}
