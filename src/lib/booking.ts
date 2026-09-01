export const MAX_OCCUPANTS = 4;

export const PAYMENT_CHOICES = ['cash', 'check', 'visa'] as const;
export type PaymentChoice = (typeof PAYMENT_CHOICES)[number];

export function maxOccupants(_rooms?: number | null) {
  return MAX_OCCUPANTS;
}

export function occupantChoices(rooms?: number | null) {
  const max = maxOccupants(rooms);
  return Array.from({ length: max }, (_, index) => index + 1);
}

export function paymentI18nKey(method?: string | null) {
  if (method === 'pay_now') return 'payment.visa';
  if (method === 'pay_later') return 'payment.cash';
  return `payment.${method || 'cash'}`;
}

export function paymentHintKey(method?: string | null) {
  if (method === 'visa' || method === 'pay_now') return 'payment.visaHint';
  if (method === 'check') return 'payment.checkHint';
  return 'payment.cashHint';
}
