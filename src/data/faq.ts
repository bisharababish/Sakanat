export const FAQ_KEYS = ['find', 'book', 'verify', 'pay', 'moveIn', 'owners', 'renter', 'blocks', 'reports'] as const;

export type FaqKey = (typeof FAQ_KEYS)[number];
