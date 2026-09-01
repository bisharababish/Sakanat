import type { Booking, BookingStatus } from '@/src/types/database';

export const MAX_OCCUPANTS = 4;
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed'];

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

export function paymentBucket(method?: string | null): PaymentChoice {
  if (method === 'visa' || method === 'pay_now') return 'visa';
  if (method === 'check') return 'check';
  return 'cash';
}

function bookingStart(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function bookingEnd(iso: string, months: number) {
  const date = bookingStart(iso);
  date.setMonth(date.getMonth() + months);
  return date;
}

export function bookingsOverlap(
  a: Pick<Booking, 'start_date' | 'months'>,
  b: Pick<Booking, 'start_date' | 'months'>,
) {
  const aStart = bookingStart(a.start_date);
  const aEnd = bookingEnd(a.start_date, a.months);
  const bStart = bookingStart(b.start_date);
  const bEnd = bookingEnd(b.start_date, b.months);
  return aStart < bEnd && bStart < aEnd;
}

export function overlappingBookings(
  booking: Pick<Booking, 'id' | 'apartment_id' | 'start_date' | 'months'>,
  all: Booking[],
  statuses: BookingStatus[] = ACTIVE_BOOKING_STATUSES,
) {
  return all.filter(
    (item) =>
      item.id !== booking.id &&
      item.apartment_id === booking.apartment_id &&
      statuses.includes(item.status) &&
      bookingsOverlap(booking, item),
  );
}

export function hasConfirmedOverlap(booking: Booking, all: Booking[]) {
  return overlappingBookings(booking, all, ['confirmed']).length > 0;
}
