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

function localDigits(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('970') || digits.startsWith('972')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
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

export function isValidStudentId(raw: string) {
  return /^\d{8,10}$/.test(raw.trim());
}

export function whatsappLink(e164: string) {
  return `https://wa.me/${e164.replace('+', '')}`;
}
