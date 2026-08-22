import { EXTRA_EDU_DOMAINS, UNIVERSITY_SEED } from '@/src/data/universities';

const listedDomains = new Set(
  UNIVERSITY_SEED.flatMap((university) => university.email_domains.map((domain) => domain.toLowerCase())),
);

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
