import { isValidArabicName, isValidEnglishName } from '@/src/lib/name';
import { isValidStudentId, splitPhone, toE164 } from '@/src/lib/phone';
import { trustReadyExtras } from '@/src/lib/trust';
import type { GenderPolicy, PersonGender, Profile } from '@/src/types/database';

export function isSeeker(profile: Profile | null | undefined) {
  return profile?.role === 'student' || profile?.role === 'renter';
}

function seekerAccountReady(profile: Profile) {
  const basics = Boolean(
    profile.full_name?.trim() &&
      isValidArabicName(profile.full_name) &&
      isValidEnglishName(profile.full_name_en ?? '') &&
      profile.phone?.trim() &&
      profile.whatsapp?.trim() &&
      profile.gender &&
      profile.city_id &&
      profile.date_of_birth &&
      profile.avatar_url,
  );
  if (!basics) return false;
  if (profile.role === 'renter') return true;
  return Boolean(
    profile.university_id &&
      isValidStudentId(profile.student_id_number ?? '') &&
      profile.major &&
      profile.degree_level &&
      profile.study_year,
  );
}

/** Which profile tab to open when booking is blocked by an incomplete profile. */
export function seekerProfileGapTab(profile: Profile | null | undefined): 'account' | 'trust' {
  if (!profile || !isSeeker(profile)) return 'account';
  if (!seekerAccountReady(profile)) return 'account';
  return 'trust';
}

export function isStudentReady(profile: Profile | null | undefined) {
  if (!profile || !isSeeker(profile)) return false;
  return seekerAccountReady(profile) && trustReadyExtras(profile);
}

export function listingFitsStudent(policy: GenderPolicy, gender?: PersonGender | null) {
  if (!gender || policy === 'any') return true;
  return policy === gender;
}

function ownerAccountReady(profile: Profile) {
  if (!profile.full_name?.trim() || !isValidArabicName(profile.full_name)) return false;
  if (!isValidEnglishName(profile.full_name_en ?? '')) return false;
  if (!profile.gender || !profile.city_id || !profile.date_of_birth || !profile.avatar_url) return false;
  const phone = profile.phone ? toE164(splitPhone(profile.phone).region, splitPhone(profile.phone).local) : null;
  const wa = profile.whatsapp ? toE164(splitPhone(profile.whatsapp).region, splitPhone(profile.whatsapp).local) : null;
  return Boolean(phone && wa);
}

/** Which profile tab to open when listing is blocked by an incomplete owner profile. */
export function ownerListingGapTab(profile: Profile | null | undefined): 'account' | 'trust' {
  if (!profile || profile.role !== 'owner') return 'account';
  if (!ownerAccountReady(profile)) return 'account';
  return 'trust';
}
