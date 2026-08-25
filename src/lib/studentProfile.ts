import type { GenderPolicy, PersonGender, Profile } from '@/src/types/database';

export function isStudentReady(profile: Profile | null | undefined) {
  if (!profile) return false;
  return Boolean(
    profile.full_name?.trim() &&
      profile.phone?.trim() &&
      profile.gender &&
      profile.city_id &&
      profile.university_id,
  );
}

export function listingFitsStudent(policy: GenderPolicy, gender?: PersonGender | null) {
  if (!gender || policy === 'any') return true;
  return policy === gender;
}
