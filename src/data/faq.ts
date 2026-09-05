export const FAQ_KEYS = ['find', 'book', 'verify', 'pay', 'moveIn', 'owners'] as const;

export type FaqKey = (typeof FAQ_KEYS)[number];
