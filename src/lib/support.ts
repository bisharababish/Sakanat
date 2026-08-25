export const SUPPORT_EMAIL = 'bishara.babish@gmail.com';

export function mailTo(subject: string, body?: string) {
  const query = new URLSearchParams({ subject, ...(body ? { body } : {}) }).toString();
  return `mailto:${SUPPORT_EMAIL}?${query}`;
}
