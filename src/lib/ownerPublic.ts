import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { TFunction } from 'i18next';

import { ageLabel } from '@/src/lib/format';
import { canShowOwnerContact, contactVisibilityLabel } from '@/src/lib/privacy';
import { supabase } from '@/src/lib/supabase';
import type { Apartment, BookingStatus, PersonGender, Profile } from '@/src/types/database';

/** Public owner fields students may see on a listing, booking, or chat. */
export const OWNER_PUBLIC_PROFILE =
  'id, full_name, full_name_en, avatar_url, gender, date_of_birth, city_id, bio, spoken_languages, phone, whatsapp, phone_visibility, whatsapp_visibility, id_verify_status';

/** Listing card only — no phone, national ID, address, or IP. */
export const LISTING_OWNER_CARD =
  'id, full_name, full_name_en, avatar_url, gender, date_of_birth, city_id, bio, spoken_languages, phone_visibility, whatsapp_visibility, id_verify_status';

export const PERSON_CARD =
  'id, full_name, full_name_en, avatar_url, role, gender, date_of_birth, city_id, university_id, major, study_year, degree_level, bio, spoken_languages, phone_visibility, whatsapp_visibility, id_verify_status, graduation_term';

export async function attachPersonCards<T extends { student_id?: string; owner_id?: string; student?: unknown; owner?: unknown }>(
  rows: T[],
): Promise<T[]> {
  const ids = [
    ...new Set(rows.flatMap((row) => [row.student_id, row.owner_id]).filter((id): id is string => Boolean(id))),
  ];
  if (!ids.length) return rows;
  const fromView = await supabase.from('person_cards').select(PERSON_CARD).in('id', ids);
  let cards = !fromView.error ? (fromView.data ?? []) : null;
  if (!cards) {
    const fromProfiles = await supabase.from('profiles').select(PERSON_CARD).in('id', ids);
    cards = fromProfiles.data ?? [];
  }
  const byId = new Map(cards.map((card) => [card.id as string, card]));
  return rows.map((row) => ({
    ...row,
    student: row.student ?? (row.student_id ? byId.get(row.student_id) ?? null : row.student),
    owner: row.owner ?? (row.owner_id ? byId.get(row.owner_id) ?? null : row.owner),
  }));
}

export async function attachListingOwnerCards<T extends Pick<Apartment, 'owner_id'> & { profiles?: Apartment['profiles'] }>(
  rows: T[],
): Promise<T[]> {
  const ids = [...new Set(rows.map((row) => row.owner_id).filter(Boolean))];
  if (!ids.length) return rows;
  const fromView = await supabase.from('profile_cards').select(LISTING_OWNER_CARD).in('id', ids);
  let cards = !fromView.error ? (fromView.data ?? []) : null;
  if (!cards) {
    const fromProfiles = await supabase.from('profiles').select(LISTING_OWNER_CARD).in('id', ids);
    cards = fromProfiles.data ?? [];
  }
  const byId = new Map(cards.map((card) => [card.id as string, card]));
  return rows.map((row) => ({
    ...row,
    profiles: row.profiles ?? ((byId.get(row.owner_id) as Apartment['profiles'] | undefined) ?? null),
  }));
}

/** Booking counterpart: contact + public card. ID number only after confirm (view-enforced). */
export const STAY_PEER_CARD =
  'id, full_name, full_name_en, avatar_url, role, gender, date_of_birth, city_id, university_id, major, study_year, degree_level, bio, spoken_languages, phone, email, whatsapp, phone_visibility, whatsapp_visibility, id_verify_status, graduation_term, student_id_number, hide_last_seen, share_emergency, home_address, national_id_number, national_id_url, university_card_url, emergency_name, emergency_phone';

export async function attachStayPeerCards<
  T extends {
    student_id?: string;
    owner_id?: string;
    profiles?: unknown;
    student?: unknown;
    owner?: unknown;
  },
>(rows: T[], peer: 'student' | 'owner' | 'both' = 'both'): Promise<T[]> {
  const ids = [
    ...new Set(
      rows.flatMap((row) => {
        const next: string[] = [];
        if (peer !== 'owner' && row.student_id) next.push(row.student_id);
        if (peer !== 'student' && row.owner_id) next.push(row.owner_id);
        return next;
      }),
    ),
  ];
  if (!ids.length) return rows;
  const fromView = await supabase.from('stay_peer_cards').select(STAY_PEER_CARD).in('id', ids);
  let cards = !fromView.error ? (fromView.data ?? []) : null;
  if (!cards) {
    const fromProfiles = await supabase.from('profiles').select(STAY_PEER_CARD).in('id', ids);
    cards = fromProfiles.data ?? [];
  }
  const byId = new Map(cards.map((card) => [card.id as string, card]));
  return rows.map((row) => {
    const student = row.student ?? (row.student_id ? byId.get(row.student_id) ?? null : row.student);
    const owner = row.owner ?? (row.owner_id ? byId.get(row.owner_id) ?? null : row.owner);
    const profiles =
      row.profiles ??
      (peer === 'owner'
        ? (row.owner_id ? byId.get(row.owner_id) ?? null : null)
        : peer === 'student'
          ? (row.student_id ? byId.get(row.student_id) ?? null : null)
          : student ?? owner ?? null);
    return { ...row, student, owner, profiles };
  });
}

export type OwnerPublicProfile = Pick<
  Profile,
  | 'id'
  | 'full_name'
  | 'full_name_en'
  | 'avatar_url'
  | 'gender'
  | 'date_of_birth'
  | 'city_id'
  | 'bio'
  | 'spoken_languages'
  | 'phone'
  | 'whatsapp'
  | 'phone_visibility'
  | 'whatsapp_visibility'
  | 'id_verify_status'
>;

type Line = { icon: ComponentProps<typeof Ionicons>['name']; text: string };

export function spokenLanguageLabels(codes: string[] | null | undefined, t: TFunction) {
  return (codes ?? [])
    .map((code) =>
      code === 'ar' ? t('profile.langAr') : code === 'en' ? t('profile.langEn') : code === 'he' ? t('profile.langHe') : code,
    )
    .filter(Boolean);
}

export function ownerPublicLines(
  owner:
    | (Partial<OwnerPublicProfile> & { gender?: PersonGender | '' | null })
    | null
    | undefined,
  t: TFunction,
  opts?: {
    cityName?: string;
    today?: Date;
    bookingStatus?: BookingStatus | null;
    phoneDisplay?: string;
    whatsappDisplay?: string;
    showContact?: boolean;
    buildings?: string[];
  },
): Line[] {
  const lines: Line[] = [];
  if (owner?.gender) lines.push({ icon: 'person-outline', text: t(`profile.${owner.gender}`) });
  const age = ageLabel(owner?.date_of_birth, t, opts?.today);
  if (age) lines.push({ icon: 'hourglass-outline', text: age });
  if (opts?.cityName) lines.push({ icon: 'location-outline', text: opts.cityName });
  const langs = spokenLanguageLabels(owner?.spoken_languages, t);
  if (langs.length) lines.push({ icon: 'chatbubbles-outline', text: langs.join(' · ') });
  if (opts?.buildings?.length) {
    lines.push({
      icon: 'business-outline',
      text:
        opts.buildings.length <= 3
          ? opts.buildings.join(' · ')
          : t('owner.buildingsCount', { count: opts.buildings.length }),
    });
  }
  if (opts?.showContact) {
    const vis = {
      phone_visibility: owner?.phone_visibility,
      whatsapp_visibility: owner?.whatsapp_visibility,
    };
    const status = opts.bookingStatus;
    if (opts.phoneDisplay) {
      lines.push({
        icon: 'call-outline',
        text: canShowOwnerContact(vis, 'phone', { bookingStatus: status })
          ? opts.phoneDisplay
          : `${t('common.phone')} · ${contactVisibilityLabel(owner?.phone_visibility, t)}`,
      });
    }
    if (opts.whatsappDisplay) {
      lines.push({
        icon: 'logo-whatsapp',
        text: canShowOwnerContact(vis, 'whatsapp', { bookingStatus: status })
          ? opts.whatsappDisplay
          : `${t('profile.whatsapp')} · ${contactVisibilityLabel(owner?.whatsapp_visibility, t)}`,
      });
    }
  }
  return lines.filter((item) => item.text);
}
