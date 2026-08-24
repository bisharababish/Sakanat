import { EXTRA_EDU_DOMAINS, UNIVERSITY_SEED } from '@/src/data/universities';

const listedDomains = new Set(
  UNIVERSITY_SEED.flatMap((university) => university.email_domains.map((domain) => domain.toLowerCase())),
);

export function sanitizeEmail(raw: string) {
  return raw
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[\u00A0\u202F]/g, '')
    .replace(/＠/g, '@')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .trim()
    .toLowerCase();
}

export function isValidEmail(raw: string) {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(sanitizeEmail(raw));
}

export function emailDomain(email: string) {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isStudentEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return false;
  if (listedDomains.has(domain)) return true;
  if (domain.endsWith('.edu') || domain.endsWith('.edu.ps')) return true;
  return EXTRA_EDU_DOMAINS.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
}

export function studentEmailError(email: string) {
  if (!email.includes('@')) return 'invalidEmail';
  if (!isStudentEmail(email)) return 'studentEmailRequired';
  return null;
}
