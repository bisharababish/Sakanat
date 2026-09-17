import { supabase } from '@/src/lib/supabase';
import type { Booking, BookingStatus } from '@/src/types/database';

export const MAX_OCCUPANTS = 4;
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed'];

/** Stable codes from supabase/booking-student-gates.sql */
export type BookingGateCode =
  | 'BOOKING_NEED_PROFILE'
  | 'BOOKING_NEED_REVIEW'
  | 'BOOKING_GENDER_MISMATCH'
  | 'BOOKING_ACCOUNT_SUSPENDED'
  | 'BOOKING_ACTIVE_STAY'
  | 'BOOKING_LISTING_OCCUPIED';

export function bookingGateCode(error: unknown): BookingGateCode | null {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error ?? '');
  if (message.includes('BOOKING_NEED_PROFILE')) return 'BOOKING_NEED_PROFILE';
  if (message.includes('BOOKING_NEED_REVIEW')) return 'BOOKING_NEED_REVIEW';
  if (message.includes('BOOKING_GENDER_MISMATCH')) return 'BOOKING_GENDER_MISMATCH';
  if (message.includes('BOOKING_ACCOUNT_SUSPENDED')) return 'BOOKING_ACCOUNT_SUSPENDED';
  if (message.includes('BOOKING_ACTIVE_STAY')) return 'BOOKING_ACTIVE_STAY';
  if (message.includes('BOOKING_LISTING_OCCUPIED')) return 'BOOKING_LISTING_OCCUPIED';
  return null;
}

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

export function stayEndDate(booking: Pick<Booking, 'start_date' | 'months'>) {
  return bookingEnd(booking.start_date, booking.months);
}

/** Pending request, or confirmed stay that has not ended yet. */
export function isActiveStay(booking: Pick<Booking, 'status' | 'start_date' | 'months'>, today = new Date()) {
  if (booking.status === 'pending') return true;
  if (booking.status !== 'confirmed') return false;
  const end = stayEndDate(booking);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return end.getTime() > startToday.getTime();
}

export function activeStayBooking(bookings: Booking[]) {
  return bookings.find((item) => isActiveStay(item)) ?? null;
}

export async function loadActiveStay(studentId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, apartment_id, student_id, owner_id, start_date, months, status')
    .eq('student_id', studentId)
    .in('status', ['pending', 'confirmed'])
    .order('start_date', { ascending: false });
  if (error) throw error;
  return activeStayBooking((data as Booking[]) ?? []);
}

export async function loadMyListingStay(studentId: string, apartmentId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, apartment_id, student_id, owner_id, start_date, months, status')
    .eq('student_id', studentId)
    .eq('apartment_id', apartmentId)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Booking | null) ?? null;
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

export type OccupiedStay = {
  apartment_id: string;
  start_date: string;
  months: number;
};

export async function loadOccupiedStays(): Promise<OccupiedStay[]> {
  try {
    const { data, error } = await supabase.rpc('occupied_listing_ids');
    if (error || !Array.isArray(data)) return [];
    return (data as OccupiedStay[]).filter((row) => row.apartment_id);
  } catch {
    return [];
  }
}

export function occupiedUntil(stay: Pick<OccupiedStay, 'start_date' | 'months'>) {
  return stayEndDate(stay);
}

export function listingOccupiedStay(apartmentId: string, stays: OccupiedStay[]) {
  const mine = stays.filter((item) => item.apartment_id === apartmentId);
  if (!mine.length) return null;
  const today = new Date();
  const covering = mine.find((item) => {
    const start = bookingStart(item.start_date);
    const end = bookingEnd(item.start_date, item.months);
    return start <= today && today < end;
  });
  if (covering) return covering;
  return [...mine].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
}

export function occupiedOverlap(
  booking: Pick<OccupiedStay, 'start_date' | 'months'>,
  stays: OccupiedStay[],
) {
  return stays.find((item) => bookingsOverlap(booking, item)) ?? null;
}

export function monthlyRent(booking: Pick<Booking, 'rent_amount' | 'months' | 'apartments'>) {
  const listed = Number(booking.apartments?.price_month);
  if (Number.isFinite(listed) && listed > 0) return listed;
  if (booking.months > 0) return Number(booking.rent_amount) / booking.months;
  return Number(booking.rent_amount) || 0;
}

export function extendedStayPatch(booking: Booking, extraMonths: number) {
  const extra = Math.max(1, Math.round(extraMonths));
  const months = booking.months + extra;
  return {
    months,
    rent_amount: Math.round(monthlyRent(booking) * months),
  };
}
