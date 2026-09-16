import type { TFunction } from 'i18next';

import { majorLabel } from '@/src/data/majors';
import { formatIls, localizedName, localizedTitle } from '@/src/lib/format';
import { listingPlaceLine } from '@/src/lib/listingPlace';
import { MESSAGE_MAX } from '@/src/lib/limits';
import { displayName } from '@/src/lib/name';
import { seekerRoleLabel } from '@/src/lib/seeker';
import type { Apartment, Profile } from '@/src/types/database';

function studyYearLabel(value: string | null | undefined, t: TFunction) {
  const year = String(value ?? '').trim();
  if (!year) return '';
  const key = `profile.year${year}`;
  const label = t(key);
  return label === key ? '' : label;
}

function degreeLabel(value: string | null | undefined, t: TFunction) {
  if (value === 'bachelor') return t('profile.bachelor');
  if (value === 'master') return t('profile.master');
  if (value === 'doctorate') return t('profile.doctorate');
  if (value === 'diploma') return t('profile.diploma');
  if (value === 'other') return t('profile.otherDegree');
  return '';
}

export function listingChatIntro(apartment: Apartment, profile: Profile, t: TFunction, lang: string) {
  const title = localizedTitle(apartment, lang);
  const place = listingPlaceLine(apartment, t);
  const city = localizedName(apartment.cities, lang);
  const price = apartment.price_month ? `${formatIls(apartment.price_month, lang)} / ${t('common.perMonth')}` : '';
  const rooms =
    apartment.rooms || apartment.bathrooms
      ? t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms })
      : '';
  const name = displayName(profile, lang) || profile.full_name;
  const uni = localizedName(profile.universities, lang);
  const major = profile.major ? majorLabel(profile.major, lang) : '';
  const year = studyYearLabel(profile.study_year, t);
  const degree = degreeLabel(profile.degree_level, t);
  const gender = profile.gender === 'male' || profile.gender === 'female' ? t(`profile.${profile.gender}`) : '';
  const listing = [title, [place, city].filter(Boolean).join(' · '), rooms, price].filter(Boolean);
  const about = [
    name,
    seekerRoleLabel(profile.role, t),
    [gender, uni].filter(Boolean).join(' · '),
    [major, degree, year].filter(Boolean).join(' · '),
  ].filter(Boolean);

  return [
    t('chat.introHello'),
    '',
    t('chat.introListing'),
    ...listing,
    '',
    t('chat.introAbout'),
    ...about,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MESSAGE_MAX);
}
