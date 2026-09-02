export const BOOKING_PAGE_SIZE = 2;
export const LISTING_PAGE_SIZE = 4;
export const OWNER_LISTING_PAGE_SIZE = 3;
export const ADMIN_LISTING_PAGE_SIZE = 2;
export const CHAT_PAGE_SIZE = 6;
export const ADMIN_CHAT_PAGE_SIZE = 3;
export const USER_PAGE_SIZE = 2;
export const CATALOG_PAGE_SIZE = 8;
export const EARNINGS_PAGE_SIZE = 8;

export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(0, page), pages - 1);
  const slice = items.slice(current * size, current * size + size);
  const from = items.length === 0 ? 0 : current * size + 1;
  const to = current * size + slice.length;
  return { pages, current, slice, from, to, total: items.length };
}
