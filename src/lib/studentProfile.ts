import { isValidArabicName, isValidEnglishName } from '@/src/lib/name';
import { isValidStudentId } from '@/src/lib/phone';
import { trustReadyExtras } from '@/src/lib/trust';
import type { GenderPolicy, PersonGender, Profile } from '@/src/types/database';

export function isSeeker(profile: Profile | null | undefined) {
  return profile?.role === 'student' || profile?.role === 'renter';
}

export function isStudentReady(profile: Profile | null | undefined) {
  if (!profile || !isSeeker(profile)) return false;
  const basics = Boolean(
    profile.full_name?.trim() &&
      isValidArabicName(profile.full_name) &&
      isValidEnglishName(profile.full_name_en ?? '') &&
      profile.phone?.trim() &&
      profile.whatsapp?.trim() &&
      profile.gender &&
      profile.city_id &&
      profile.date_of_birth &&
      profile.avatar_url &&
      trustReadyExtras(profile),
  );
  if (profile.role === 'renter') return basics;
  return (
    basics &&
    Boolean(
      profile.university_id &&
        isValidStudentId(profile.student_id_number ?? '') &&
        profile.major &&
        profile.degree_level &&
        profile.study_year,
    )
  );
}

export function listingFitsStudent(policy: GenderPolicy, gender?: PersonGender | null) {
  if (!gender || policy === 'any') return true;
  return policy === gender;
}
