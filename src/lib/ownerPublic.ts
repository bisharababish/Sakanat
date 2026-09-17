import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { TFunction } from 'i18next';

import { ageLabel } from '@/src/lib/format';
import { canShowOwnerContact, contactVisibilityLabel } from '@/src/lib/privacy';
import type { BookingStatus, PersonGender, Profile } from '@/src/types/database';

/** Public owner fields students may see on a listing, booking, or chat. */
export const OWNER_PUBLIC_PROFILE =
  'id, full_name, full_name_en, avatar_url, gender, date_of_birth, city_id, bio, spoken_languages, phone, whatsapp, phone_visibility, whatsapp_visibility, id_verify_status';

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
