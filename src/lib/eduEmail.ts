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
  return sanitizeEmail(email).split('@')[1] ?? '';
}

export function isStudentEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return false;
  return domain.endsWith('.edu') || domain.endsWith('.edu.ps');
}

export function normalizeEmailDomain(raw: string) {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

export function formatEmailDomains(domains: string[] | null | undefined) {
  return [...new Set((domains ?? []).map(normalizeEmailDomain).filter(Boolean))];
}

export function emailMatchesDomains(email: string, domains: string[] | null | undefined) {
  const domain = emailDomain(email);
  const list = formatEmailDomains(domains);
  if (!domain || list.length === 0) return true;
  return list.some((item) => domain === item || domain.endsWith(`.${item}`));
}

export function studentEmailError(email: string, domains?: string[] | null) {
  const clean = sanitizeEmail(email);
  if (!clean.includes('@') || !isValidEmail(clean)) return 'invalidEmail';
  if (!isStudentEmail(clean)) return 'studentEmailRequired';
  if (!emailMatchesDomains(clean, domains)) return 'universityEmailMismatch';
  return null;
}
