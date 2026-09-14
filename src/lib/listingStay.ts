import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TFunction } from 'i18next';

import { localizedPair } from '@/src/lib/format';
import { listingPlaceLine, type PlaceFields } from '@/src/lib/listingPlace';
import { MESSAGE_MAX } from '@/src/lib/limits';
import { supabase } from '@/src/lib/supabase';

export type StayFields = {
  house_rules_ar?: string | null;
  house_rules_en?: string | null;
  check_in_notes_ar?: string | null;
  check_in_notes_en?: string | null;
};

export function listingStayPayload(
  houseRulesAr: string,
  houseRulesEn: string,
  checkInAr: string,
  checkInEn: string,
): StayFields {
  const arRules = houseRulesAr.trim();
  const enRules = houseRulesEn.trim();
  const arIn = checkInAr.trim();
  const enIn = checkInEn.trim();
  return {
    house_rules_ar: arRules || enRules || null,
    house_rules_en: enRules || arRules || null,
    check_in_notes_ar: arIn || enIn || null,
    check_in_notes_en: enIn || arIn || null,
  };
}

export function isListingStaySqlMissing(message: string) {
  return /house_rules|check_in_notes/i.test(message);
}

export function stayFromApartment(item: StayFields | null | undefined): StayFields {
  return {
    house_rules_ar: (item?.house_rules_ar ?? '').trim() || null,
    house_rules_en: (item?.house_rules_en ?? '').trim() || null,
    check_in_notes_ar: (item?.check_in_notes_ar ?? '').trim() || null,
    check_in_notes_en: (item?.check_in_notes_en ?? '').trim() || null,
  };
}

export async function applyStayToBuilding(opts: {
  ownerId: string;
  buildingName: string;
  stay: StayFields;
}) {
  const key = opts.buildingName.trim().toLowerCase();
  if (!key) return 0;
  const { data, error } = await supabase
    .from('apartments')
    .select('id, building_name')
    .eq('owner_id', opts.ownerId);
  if (error) throw error;
  const ids = ((data as { id: string; building_name?: string | null }[]) ?? [])
    .filter((row) => (row.building_name ?? '').trim().toLowerCase() === key)
    .map((row) => row.id);
  if (ids.length === 0) return 0;
  const { error: updateError } = await supabase.from('apartments').update(opts.stay).in('id', ids);
  if (updateError) throw updateError;
  return ids.length;
}

export function listingNeedsStayNotes(item?: StayFields | null) {
  const rules = (item?.house_rules_ar || item?.house_rules_en || '').trim();
  const checkIn = (item?.check_in_notes_ar || item?.check_in_notes_en || '').trim();
  return !rules || !checkIn;
}

export function listingHasCheckIn(item?: StayFields | null) {
  return Boolean((item?.check_in_notes_ar || item?.check_in_notes_en || '').trim());
}

export function stayCheckInChatBody(
  apartment: (StayFields & PlaceFields) | null | undefined,
  t: TFunction,
  lang: string,
) {
  if (!apartment) return '';
  const checkIn = localizedPair(apartment.check_in_notes_ar, apartment.check_in_notes_en, lang);
  if (!checkIn) return '';
  const rules = localizedPair(apartment.house_rules_ar, apartment.house_rules_en, lang);
  const place = listingPlaceLine(apartment, t);
  const lines = [t('listing.checkIn')];
  if (place) lines.push(place);
  lines.push(checkIn);
  if (rules) lines.push('', t('listing.houseRules'), rules);
  return lines.join('\n').slice(0, MESSAGE_MAX);
}

const CHECKIN_SENT_KEY = 'sakanat.checkInSent';

export async function loadCheckInSentIds() {
  try {
    const raw = await AsyncStorage.getItem(CHECKIN_SENT_KEY);
    const ids = JSON.parse(raw || '[]') as unknown;
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

export async function markCheckInSent(bookingId: string) {
  const ids = await loadCheckInSentIds();
  ids.add(bookingId);
  await AsyncStorage.setItem(CHECKIN_SENT_KEY, JSON.stringify([...ids].slice(-400)));
}
