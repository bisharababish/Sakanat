import type { TFunction } from 'i18next';

export type HousingType = 'apartment' | 'studio' | 'room';
export type FurnishLevel = 'full' | 'part' | 'empty';
export type ConditionLevel = 'new' | 'good' | 'fair';
export type BillMode = 'in' | 'extra';

export type ListingOffer = {
  area: string;
  street: string;
  housing: HousingType | '';
  availableFrom: string;
  minStay: string;
  occupants: string;
  deposit: string;
  water: BillMode | '';
  power: BillMode | '';
  net: BillMode | '';
  condition: ConditionLevel | '';
  furnish: FurnishLevel | '';
  video: string;
};

export const EMPTY_OFFER: ListingOffer = {
  area: '',
  street: '',
  housing: '',
  availableFrom: '',
  minStay: '',
  occupants: '',
  deposit: '',
  water: '',
  power: '',
  net: '',
  condition: '',
  furnish: '',
  video: '',
};

const HOUSING = new Set<HousingType>(['apartment', 'studio', 'room']);
const FURNISH = new Set<FurnishLevel>(['full', 'part', 'empty']);
const CONDITION = new Set<ConditionLevel>(['new', 'good', 'fair']);
const BILL = new Set<BillMode>(['in', 'extra']);

function decodeToken(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function encodeToken(raw: string) {
  return encodeURIComponent(raw.trim());
}

export function isOfferToken(value: string) {
  return value.startsWith('~');
}

export function publicAmenities(list: string[] | null | undefined) {
  return (list ?? []).filter((item) => item && !isOfferToken(item));
}

export function readOffer(list: string[] | null | undefined): ListingOffer {
  const offer: ListingOffer = { ...EMPTY_OFFER };
  for (const item of list ?? []) {
    if (!isOfferToken(item)) continue;
    const body = item.slice(1);
    const cut = body.indexOf('=');
    if (cut < 0) continue;
    const key = body.slice(0, cut);
    const value = decodeToken(body.slice(cut + 1));
    if (key === 'kind' && HOUSING.has(value as HousingType)) offer.housing = value as HousingType;
    else if (key === 'furnish' && FURNISH.has(value as FurnishLevel)) offer.furnish = value as FurnishLevel;
    else if (key === 'cond' && CONDITION.has(value as ConditionLevel)) offer.condition = value as ConditionLevel;
    else if (key === 'water' && BILL.has(value as BillMode)) offer.water = value as BillMode;
    else if (key === 'power' && BILL.has(value as BillMode)) offer.power = value as BillMode;
    else if (key === 'net' && BILL.has(value as BillMode)) offer.net = value as BillMode;
    else if (key === 'from' && /^\d{4}-\d{2}-\d{2}$/.test(value)) offer.availableFrom = value;
    else if (key === 'stay' && /^\d{1,2}$/.test(value)) offer.minStay = value;
    else if (key === 'people' && /^\d{1,2}$/.test(value)) offer.occupants = value;
    else if (key === 'deposit' && /^\d{1,7}$/.test(value)) offer.deposit = value;
    else if (key === 'area') offer.area = value.slice(0, 80);
    else if (key === 'street') offer.street = value.slice(0, 80);
    else if (key === 'video') offer.video = value.slice(0, 300);
  }
  if (!offer.furnish && (list ?? []).includes('furnished')) offer.furnish = 'full';
  return offer;
}

export function packAmenities(amenities: string[], offer: ListingOffer) {
  const base = publicAmenities(amenities).filter((item) => item !== 'furnished');
  if (offer.furnish === 'full' || offer.furnish === 'part') base.push('furnished');
  const tokens: string[] = [];
  if (offer.housing) tokens.push(`~kind=${offer.housing}`);
  if (offer.furnish) tokens.push(`~furnish=${offer.furnish}`);
  if (offer.condition) tokens.push(`~cond=${offer.condition}`);
  if (offer.water) tokens.push(`~water=${offer.water}`);
  if (offer.power) tokens.push(`~power=${offer.power}`);
  if (offer.net) tokens.push(`~net=${offer.net}`);
  if (offer.availableFrom) tokens.push(`~from=${offer.availableFrom}`);
  if (offer.minStay) tokens.push(`~stay=${offer.minStay}`);
  if (offer.occupants) tokens.push(`~people=${offer.occupants}`);
  if (offer.deposit) tokens.push(`~deposit=${offer.deposit.replace(/\D/g, '').slice(0, 7)}`);
  if (offer.area.trim()) tokens.push(`~area=${encodeToken(offer.area)}`);
  if (offer.street.trim()) tokens.push(`~street=${encodeToken(offer.street)}`);
  if (offer.video.trim()) tokens.push(`~video=${encodeToken(offer.video)}`);
  return [...new Set([...base, ...tokens])];
}

export type OfferSearch = {
  area?: string;
  housing?: HousingType | '';
  furnish?: FurnishLevel | '';
  minStay?: string;
  moveIn?: string;
};

export function offerMatches(amenities: string[] | null | undefined, filters: OfferSearch) {
  const offer = readOffer(amenities);
  const area = (filters.area ?? '').trim().toLowerCase();
  if (area && !offer.area.toLowerCase().includes(area)) return false;
  if (filters.housing && offer.housing !== filters.housing) return false;
  if (filters.furnish === 'full') {
    const full = offer.furnish === 'full' || (!offer.furnish && (amenities ?? []).includes('furnished'));
    if (!full) return false;
  } else if (filters.furnish === 'part' && offer.furnish !== 'part') return false;
  else if (filters.furnish === 'empty' && offer.furnish !== 'empty') return false;
  const stay = Number(filters.minStay);
  if (filters.minStay && Number.isFinite(stay) && stay > 0) {
    const required = Number(offer.minStay);
    if (Number.isFinite(required) && required > 0 && required > stay) return false;
  }
  if (filters.moveIn && offer.availableFrom && offer.availableFrom > filters.moveIn) return false;
  return true;
}

export function offerFacts(amenities: string[] | null | undefined, t: TFunction) {
  const offer = readOffer(amenities);
  const lines: { icon: 'business-outline' | 'map-outline' | 'home-outline' | 'calendar-outline' | 'time-outline' | 'people-outline' | 'cash-outline' | 'water-outline' | 'flash-outline' | 'wifi-outline' | 'sparkles-outline' | 'bed-outline' | 'videocam-outline'; text: string }[] = [];
  if (offer.area) lines.push({ icon: 'map-outline', text: offer.area });
  if (offer.street) lines.push({ icon: 'business-outline', text: offer.street });
  if (offer.housing) lines.push({ icon: 'home-outline', text: t(`offer.housing.${offer.housing}`) });
  if (offer.availableFrom) lines.push({ icon: 'calendar-outline', text: t('offer.available', { date: offer.availableFrom }) });
  if (offer.minStay) lines.push({ icon: 'time-outline', text: t('offer.minStay', { count: offer.minStay }) });
  if (offer.occupants) lines.push({ icon: 'people-outline', text: t('offer.occupants', { count: offer.occupants }) });
  if (offer.deposit) lines.push({ icon: 'cash-outline', text: t('offer.deposit', { amount: offer.deposit }) });
  const bills = [
    offer.water ? t('offer.bill', { name: t('offer.water'), mode: t(`offer.billMode.${offer.water}`) }) : '',
    offer.power ? t('offer.bill', { name: t('offer.power'), mode: t(`offer.billMode.${offer.power}`) }) : '',
    offer.net ? t('offer.bill', { name: t('offer.internet'), mode: t(`offer.billMode.${offer.net}`) }) : '',
  ].filter(Boolean);
  if (bills.length) lines.push({ icon: 'flash-outline', text: bills.join(' · ') });
  if (offer.condition) lines.push({ icon: 'sparkles-outline', text: t(`offer.condition.${offer.condition}`) });
  if (offer.furnish) lines.push({ icon: 'bed-outline', text: t(`offer.furnish.${offer.furnish}`) });
  return { offer, lines };
}
