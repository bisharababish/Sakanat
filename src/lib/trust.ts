import { isValidStudentId, sanitizeStudentId, splitPhone, toE164 } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import type { IdVerifyStatus, Profile } from '@/src/types/database';

export const SEEKER_BOOKING_PROFILE =
  'id, full_name, avatar_url, phone, email, whatsapp, gender, university_id, city_id, role, major, study_year, degree_level, student_id_number, date_of_birth, home_address, national_id_number, national_id_url, university_card_url, id_verify_status, emergency_name, emergency_phone, last_seen_ip, phone_visibility, whatsapp_visibility, hide_last_seen, share_emergency';


export function sanitizeNationalId(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 9);
}

/** Palestinian / Israeli civil ID check digit (Luhn-style, 9 digits). */
export function nationalIdChecksumOk(raw: string) {
  const id = raw.replace(/\D/g, '').padStart(9, '0');
  if (!/^\d{9}$/.test(id) || id === '000000000') return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    let product = Number(id[i]) * ((i % 2) + 1);
    if (product > 9) product -= 9;
    sum += product;
  }
  return sum % 10 === 0;
}

export function isValidNationalId(raw: string) {
  const id = raw.trim();
  return /^\d{9}$/.test(id) && nationalIdChecksumOk(id);
}

export function isValidHomeAddress(raw: string) {
  const v = raw.trim();
  if (v.length < 12) return false;
  const compact = v.toLowerCase().replace(/\s+/g, '');
  if (new Set(compact).size < 5) return false;
  if (!/[A-Za-z\u0600-\u06FF]/.test(v)) return false;
  if (!/\d|[A-Za-z\u0600-\u06FF].*[A-Za-z\u0600-\u06FF]/.test(v)) return false;
  return true;
}

export function isValidEmergencyName(raw: string) {
  const v = raw.trim().replace(/\s+/g, ' ');
  if (v.length < 5) return false;
  const parts = v.split(' ').filter(Boolean);
  if (parts.length < 2) return false;
  if (!parts.every((part) => part.length >= 2 && /^[A-Za-z\u0600-\u06FF'’-]+$/.test(part))) return false;
  if (new Set(v.toLowerCase().replace(/\s+/g, '')).size < 4) return false;
  return true;
}

export function isValidBio(raw: string) {
  const v = raw.trim();
  if (!v) return true;
  return v.length >= 20 && v.length <= 400;
}

export function nationalIdExpiryState(expiresAt?: string | null) {
  if (!expiresAt) return 'missing' as const;
  const end = new Date(`${expiresAt.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(end.getTime())) return 'missing' as const;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return 'expired' as const;
  if (days <= 60) return 'soon' as const;
  return 'ok' as const;
}

/** Expiry is usable for trust: present and not expired (soon is still valid). */
export function isValidNationalIdExpiry(expiresAt?: string | null) {
  const state = nationalIdExpiryState(expiresAt);
  return state === 'ok' || state === 'soon';
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

/** ID verification progress for student, renter, or owner. */
export function accountVerification(profile: Profile | null | undefined) {
  if (!profile || profile.role === 'admin') return null;
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

/** @deprecated use accountVerification */
export function seekerVerification(profile: Profile | null | undefined) {
  return accountVerification(profile);
}

export function hasIdDocs(profile: Profile | null | undefined) {
  if (!profile) return false;
  const national = Boolean(profile.national_id_url);
  if (profile.role === 'student') return national && Boolean(profile.university_card_url);
  if (profile.role === 'renter' || profile.role === 'owner') return national;
  return false;
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
        | 'hide_last_seen'
        | 'share_emergency'
      >
    | null
    | undefined,
  t: (key: string) => string,
  opts?: { isAdmin?: boolean },
) {
  if (!profile) return [];
  const status = profile.id_verify_status ?? 'none';
  const statusLine =
    status === 'approved'
      ? t('profile.verifiedStudent')
      : status === 'pending'
        ? t('profile.idPendingReview')
        : status === 'rejected'
          ? t('profile.idRejected')
          : '';
  const shareEmergency = opts?.isAdmin || profile.share_emergency !== false;
  const showIp = opts?.isAdmin || !profile.hide_last_seen;
  return [
    statusLine,
    profile.home_address ? `${t('profile.homeAddress')}: ${profile.home_address}` : '',
    profile.national_id_number ? `${t('profile.nationalId')} ${profile.national_id_number}` : '',
    shareEmergency && profile.emergency_name
      ? `${t('profile.emergencyName')}: ${profile.emergency_name}`
      : '',
    shareEmergency && profile.emergency_phone
      ? `${t('profile.emergencyPhone')} ${profile.emergency_phone}`
      : '',
    showIp && profile.last_seen_ip ? `${t('profile.deviceIp')} ${profile.last_seen_ip}` : '',
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
      isValidNationalIdExpiry(profile.national_id_expires_at) &&
      profile.national_id_url &&
      (profile.role === 'renter' || profile.university_card_url) &&
      isValidEmergencyName(profile.emergency_name ?? '') &&
      emergencyE164 &&
      emergencyE164 !== studentPhone,
  );
}

/** Owner may create/unhide listings when admin-approved and trust profile is complete. */
export function ownerReadyForListing(profile: Profile | null | undefined) {
  if (!profile || profile.role !== 'owner') return false;
  if ((profile.account_status ?? 'active') !== 'active') return false;
  if (profile.owner_status !== 'approved') return false;
  if (!profile.full_name?.trim() || !profile.full_name_en?.trim()) return false;
  if (!profile.gender || !profile.city_id || !profile.date_of_birth || !profile.avatar_url) return false;
  if (!isValidNationalId(profile.national_id_number ?? '')) return false;
  if (!isValidNationalIdExpiry(profile.national_id_expires_at)) return false;
  if (!profile.national_id_url || !profile.id_docs_consent_at) return false;
  if (idVerifyStatus(profile) !== 'approved') return false;
  if (!isValidEmergencyName(profile.emergency_name ?? '')) return false;
  const phone = profile.phone ? toE164(splitPhone(profile.phone).region, splitPhone(profile.phone).local) : null;
  const emergency = splitPhone(profile.emergency_phone);
  const emergencyE164 = toE164(emergency.region, emergency.local);
  if (!phone || !emergencyE164 || emergencyE164 === phone) return false;
  const wa = profile.whatsapp ? toE164(splitPhone(profile.whatsapp).region, splitPhone(profile.whatsapp).local) : null;
  if (!wa) return false;
  return true;
}

export function listingGateMessage(code: string | undefined, t: (key: string) => string) {
  if (code === 'LISTING_OWNER_PENDING' || /LISTING_OWNER_PENDING/i.test(code ?? '')) {
    return t('owner.listingNeedApproval');
  }
  if (code === 'LISTING_OWNER_SUSPENDED' || /LISTING_OWNER_SUSPENDED/i.test(code ?? '')) {
    return t('owner.listingSuspended');
  }
  if (code === 'LISTING_NEED_PROFILE' || /LISTING_NEED_PROFILE/i.test(code ?? '')) {
    return t('owner.listingNeedVerify');
  }
  return null;
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
