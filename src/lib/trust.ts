import { isValidStudentId, sanitizeStudentId, splitPhone, toE164 } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import type { IdVerifyStatus, Profile } from '@/src/types/database';

export const SEEKER_BOOKING_PROFILE =
  'id, full_name, avatar_url, phone, email, whatsapp, gender, university_id, city_id, role, major, study_year, degree_level, student_id_number, date_of_birth, home_address, national_id_number, national_id_url, university_card_url, id_verify_status, emergency_name, emergency_phone, last_seen_ip';

export function sanitizeNationalId(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 9);
}

export function isValidNationalId(raw: string) {
  return /^\d{9}$/.test(raw.trim());
}

export function isValidHomeAddress(raw: string) {
  return raw.trim().length >= 8;
}

export function isValidEmergencyName(raw: string) {
  return raw.trim().length >= 2;
}

export function sanitizeStudentIdDigits(raw: string) {
  return sanitizeStudentId(raw);
}

export function isValidStudentIdNumber(raw: string) {
  return isValidStudentId(raw);
}

export type VerificationItemId = 'universityCard' | 'nationalCard';

export function idVerifyStatus(profile: Profile | null | undefined): IdVerifyStatus {
  return profile?.id_verify_status ?? 'none';
}

export function isIdVerified(profile: Profile | null | undefined) {
  return idVerifyStatus(profile) === 'approved';
}

export function seekerVerification(profile: Profile | null | undefined) {
  if (!profile || (profile.role !== 'student' && profile.role !== 'renter')) return null;
  const items: { id: VerificationItemId; done: boolean }[] = [
    ...(profile.role === 'student'
      ? [{ id: 'universityCard' as const, done: Boolean(profile.university_card_url) }]
      : []),
    { id: 'nationalCard', done: Boolean(profile.national_id_url) },
  ];
  const uploaded = items.every((item) => item.done);
  const status = idVerifyStatus(profile);
  return {
    items,
    ready: uploaded,
    uploaded,
    status,
    verified: status === 'approved',
    pendingReview: uploaded && status === 'pending',
    rejected: status === 'rejected',
  };
}

export function hasIdDocs(profile: Profile | null | undefined) {
  if (!profile) return false;
  const national = Boolean(profile.national_id_url);
  if (profile.role === 'renter') return national;
  return national && Boolean(profile.university_card_url);
}

export async function fetchPublicIp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    const json = (await response.json()) as { ip?: string };
    const ip = json.ip?.trim() ?? '';
    return ip.length > 6 && ip.length < 64 ? ip : null;
  } catch {
    return null;
  }
}

export function seekerTrustDetails(
  profile:
    | Pick<
        Profile,
        | 'home_address'
        | 'national_id_number'
        | 'emergency_name'
        | 'emergency_phone'
        | 'last_seen_ip'
        | 'id_verify_status'
      >
    | null
    | undefined,
  t: (key: string) => string,
) {
  if (!profile) return [];
  const status = profile.id_verify_status ?? 'none';
  const statusLine =
    status === 'approved'
      ? t('profile.idVerified')
      : status === 'pending'
        ? t('profile.idPendingReview')
        : status === 'rejected'
          ? t('profile.idRejected')
          : '';
  return [
    statusLine,
    profile.home_address ? `${t('profile.homeAddress')}: ${profile.home_address}` : '',
    profile.national_id_number ? `${t('profile.nationalId')} ${profile.national_id_number}` : '',
    profile.emergency_name
      ? `${t('profile.emergencyName')}: ${profile.emergency_name}`
      : '',
    profile.emergency_phone
      ? `${t('profile.emergencyPhone')} ${profile.emergency_phone}`
      : '',
    profile.last_seen_ip ? `${t('profile.deviceIp')} ${profile.last_seen_ip}` : '',
  ].filter(Boolean);
}

export function trustReadyExtras(profile: Profile | null | undefined) {
  if (!profile) return false;
  const emergency = splitPhone(profile.emergency_phone);
  const studentPhone = profile.phone ? toE164(splitPhone(profile.phone).region, splitPhone(profile.phone).local) : null;
  const emergencyE164 = toE164(emergency.region, emergency.local);
  return Boolean(
    isValidHomeAddress(profile.home_address ?? '') &&
      isValidNationalId(profile.national_id_number ?? '') &&
      profile.national_id_url &&
      (profile.role === 'renter' || profile.university_card_url) &&
      isValidEmergencyName(profile.emergency_name ?? '') &&
      emergencyE164 &&
      emergencyE164 !== studentPhone,
  );
}

export async function setIdVerifyStatus(
  userId: string,
  status: 'approved' | 'rejected' | 'pending',
  note?: string | null,
  adminId?: string | null,
) {
  const patch =
    status === 'approved'
      ? {
          id_verify_status: status,
          id_verify_note: null as string | null,
          id_verified_at: new Date().toISOString(),
          id_verified_by: adminId ?? null,
        }
      : status === 'rejected'
        ? {
            id_verify_status: status,
            id_verify_note: note?.trim() || null,
            id_verified_at: null as string | null,
            id_verified_by: adminId ?? null,
          }
        : {
            id_verify_status: 'pending' as const,
            id_verify_note: null as string | null,
            id_verified_at: null as string | null,
            id_verified_by: null as string | null,
          };
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  return error;
}
