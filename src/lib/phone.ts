export type PhoneRegion = 'ps' | 'il';

export function regionPrefix(region: PhoneRegion) {
  return region === 'ps' ? '+970' : '+972';
}

export function splitPhone(value?: string | null): { region: PhoneRegion; local: string } {
  const raw = (value ?? '').trim();
  if (raw.startsWith('+970')) return { region: 'ps', local: raw.slice(4) };
  if (raw.startsWith('970')) return { region: 'ps', local: raw.slice(3) };
  if (raw.startsWith('+972')) return { region: 'il', local: raw.slice(4) };
  if (raw.startsWith('972')) return { region: 'il', local: raw.slice(3) };
  return { region: 'ps', local: raw.replace(/\D/g, '') };
}

export const PHONE_LOCAL_LEN = 9;
const PHONE_SLACK = 1;

function stripCountry(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('970') || digits.startsWith('972')) digits = digits.slice(3);
  return digits;
}

function localDigits(raw: string) {
  let digits = stripCountry(raw);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, PHONE_LOCAL_LEN);
}

export function phoneLocalMax(raw: string) {
  const digits = stripCountry(raw);
  return (digits.startsWith('0') ? PHONE_LOCAL_LEN + 1 : PHONE_LOCAL_LEN) + PHONE_SLACK;
}

/** Official length, plus one extra digit while typing. */
export function sanitizePhoneLocal(raw: string) {
  const digits = stripCountry(raw);
  return digits.slice(0, phoneLocalMax(digits));
}

export function toE164(region: PhoneRegion, raw: string) {
  const local = localDigits(raw);
  if (region === 'ps') {
    if (!/^5[69]\d{7}$/.test(local)) return null;
    return `+970${local}`;
  }
  if (!/^5\d{8}$/.test(local)) return null;
  return `+972${local}`;
}

export function isValidMobile(region: PhoneRegion, raw: string) {
  return Boolean(toE164(region, raw));
}

export function sameMobile(
  aRegion: PhoneRegion,
  aLocal: string,
  bRegion: PhoneRegion,
  bLocal: string,
) {
  if (!aLocal.trim() || !bLocal.trim()) return false;
  const a = toE164(aRegion, aLocal);
  const b = toE164(bRegion, bLocal);
  if (a && b) return a === b;
  return aRegion === bRegion && aLocal.replace(/\D/g, '') === bLocal.replace(/\D/g, '');
}

export function sanitizeStudentId(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
}

export function isValidStudentId(raw: string) {
  return /^[A-Za-z0-9]{1,10}$/.test(raw.trim());
}

export function whatsappLink(e164: string) {
  return `https://wa.me/${e164.replace('+', '')}`;
}
