export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const NAME_WORD_MAX = 4;

export function cleanName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ');
}

export function nameWords(raw: string) {
  return cleanName(raw).split(' ').filter(Boolean);
}

function limitNameWords(raw: string) {
  const trailingSpace = /[ \t]$/.test(raw);
  const words = raw.trim().split(/\s+/).filter(Boolean).slice(0, NAME_WORD_MAX);
  if (words.length === 0) return '';
  if (words.length >= NAME_WORD_MAX) return words.join(' ');
  return trailingSpace ? `${words.join(' ')} ` : words.join(' ');
}

export function sanitizeEnglishName(raw: string) {
  return limitNameWords(raw.replace(/[^A-Za-z '\-]/g, ''));
}

export function sanitizeArabicName(raw: string) {
  return limitNameWords(raw.replace(/[^\p{Script=Arabic}\p{M} '\-]/gu, ''));
}

export function sanitizeNameInput(raw: string) {
  return sanitizeEnglishName(sanitizeArabicName(raw));
}

function lettersOnly(word: string) {
  return word.replace(/['\-]/g, '').replace(/\p{M}/gu, '');
}

export function isValidEnglishName(raw: string) {
  const words = nameWords(raw);
  if (words.length < 2 || words.length > NAME_WORD_MAX) return false;
  return words.every((word) => {
    if (lettersOnly(word).length < NAME_MIN) return false;
    return /^[A-Za-z]+(?:['\-][A-Za-z]+)*$/.test(word);
  });
}

export function isValidArabicName(raw: string) {
  const words = nameWords(raw);
  if (words.length < 2 || words.length > NAME_WORD_MAX) return false;
  return words.every((word) => {
    if (lettersOnly(word).length < NAME_MIN) return false;
    return /^[\p{Script=Arabic}\p{M}]+(?:['\-][\p{Script=Arabic}\p{M}]+)*$/u.test(word);
  });
}

export function isValidName(raw: string) {
  return isValidArabicName(raw) || isValidEnglishName(raw);
}

export function namePartCount(raw: string) {
  const words = nameWords(raw);
  if (!raw.trim()) return 0;
  const next = /[ \t]$/.test(raw) && words.length < NAME_WORD_MAX ? words.length + 1 : words.length;
  return Math.min(Math.max(next, 1), NAME_WORD_MAX);
}

function hasArabic(raw: string) {
  return /\p{Script=Arabic}/u.test(raw);
}

function hasLatin(raw: string) {
  return /[A-Za-z]/.test(raw);
}

export function namesFromProfile(fullName?: string | null, englishName?: string | null) {
  const stored = (fullName ?? '').trim();
  const storedEn = (englishName ?? '').trim();
  if (storedEn) return { en: storedEn, ar: hasArabic(stored) ? stored : '' };
  if (hasArabic(stored) && !hasLatin(stored)) return { en: '', ar: stored };
  if (hasLatin(stored) && !hasArabic(stored)) return { en: stored, ar: '' };
  return { en: sanitizeEnglishName(stored), ar: sanitizeArabicName(stored) };
}

export function displayName(
  profile: { full_name?: string | null; full_name_en?: string | null } | null | undefined,
  lang?: string,
) {
  const ar = (profile?.full_name ?? '').trim();
  const en = (profile?.full_name_en ?? '').trim();
  if (lang?.startsWith('en')) return en || ar;
  return ar || en;
}

export function publicName(profile: { full_name?: string | null } | null | undefined) {
  return (profile?.full_name ?? '').trim();
}
