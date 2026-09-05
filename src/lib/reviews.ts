import { supabase } from '@/src/lib/supabase';
import type { ApartmentReview, Booking } from '@/src/types/database';

export const REVIEW_NOTE_MIN = 10;
export const REVIEW_NOTE_MAX = 400;

export function stayEnded(booking: Pick<Booking, 'start_date' | 'months'>) {
  const start = new Date(`${booking.start_date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return false;
  start.setMonth(start.getMonth() + booking.months);
  return Date.now() >= start.getTime();
}

export function canReviewStay(booking: Pick<Booking, 'status' | 'start_date' | 'months'>) {
  if (booking.status === 'completed') return true;
  return booking.status === 'confirmed' && stayEnded(booking);
}

export function isValidReview(stars: number, note: string) {
  return stars >= 1 && stars <= 5 && note.trim().length >= REVIEW_NOTE_MIN;
}

export async function loadApartmentReviews(apartmentId: string) {
  const { data, error } = await supabase
    .from('apartment_reviews')
    .select('id, booking_id, apartment_id, student_id, stars, note, author_name, created_at')
    .eq('apartment_id', apartmentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ApartmentReview[]) ?? [];
}

export async function loadMyReviews(studentId: string) {
  const { data, error } = await supabase
    .from('apartment_reviews')
    .select('id, booking_id, apartment_id, student_id, stars, note, author_name, created_at')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data as ApartmentReview[]) ?? [];
}

export async function loadPendingReview(studentId: string) {
  const [{ data: bookings }, reviews] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, apartment_id, student_id, owner_id, start_date, months, status')
      .eq('student_id', studentId)
      .in('status', ['confirmed', 'completed']),
    loadMyReviews(studentId),
  ]);
  return pendingReviewBooking((bookings as Booking[]) ?? [], reviews);
}

export function pendingReviewBooking(
  bookings: Booking[],
  reviews: Pick<ApartmentReview, 'booking_id'>[],
) {
  const done = new Set(reviews.map((item) => item.booking_id));
  return bookings.find((item) => canReviewStay(item) && !done.has(item.id)) ?? null;
}

export async function submitApartmentReview(input: {
  booking: Booking;
  studentId: string;
  authorName: string;
  stars: number;
  note: string;
  existingId?: string;
}) {
  const note = input.note.trim();
  if (!isValidReview(input.stars, note)) {
    throw new Error('invalid-review');
  }
  const row = {
    booking_id: input.booking.id,
    apartment_id: input.booking.apartment_id,
    student_id: input.studentId,
    stars: input.stars,
    note,
    author_name: input.authorName.trim() || 'Student',
  };
  if (input.existingId) {
    const { error } = await supabase.from('apartment_reviews').update(row).eq('id', input.existingId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('apartment_reviews').insert(row);
  if (error) throw error;
}
