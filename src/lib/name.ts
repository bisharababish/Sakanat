export const NAME_MIN = 2;
export const NAME_MAX = 40;

export function sanitizeNameInput(raw: string) {
  return raw.replace(/[^\p{L}\p{M} '\-]/gu, '').slice(0, NAME_MAX);
}

export function cleanName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidName(raw: string) {
  const name = cleanName(raw);
  if (name.length < NAME_MIN || name.length > NAME_MAX) return false;
  return /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u.test(name);
}
