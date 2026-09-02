export const MESSAGE_MAX = 2000;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function photoExt(name: string) {
  const ext = name.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
  return PHOTO_TYPES.has(ext) ? ext : 'jpg';
}
