import type { TFunction } from 'i18next';
import type { Apartment, Booking } from '@/src/types/database';

import { extendedStayPatch } from '@/src/lib/booking';
import { hideListingConversation } from '@/src/lib/chat';
import { formatIls, formatStayRange, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';

export function bookingCopyText(booking: Booking, t: TFunction, lang: string) {
  const title = localizedTitle(booking.apartments, lang) || t('owner.untitledUnit');
  const place = booking.apartments
    ? [booking.apartments.building_name, booking.apartments.unit_number].filter(Boolean).join(' · ')
    : '';
  return [
    t('appName'),
    title,
    place,
    `${t('booking.duration')}: ${formatStayRange(booking.start_date, booking.months, lang)} (${booking.months} ${
      booking.months === 1 ? t('common.month') : t('common.months')
    })`,
    `${t('booking.rent')}: ${formatIls(Number(booking.rent_amount), lang)}`,
    `${t('booking.occupants')}: ${
      booking.occupants === 1 ? t('booking.onePerson') : t('booking.people', { count: booking.occupants })
    }`,
    `${t('booking.statusFilter')}: ${t(`bookingStatus.${booking.status}`)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function postBookingChat(booking: Booking, senderId: string, body: string) {
  if (!booking.apartments || !booking.student_id) return null;
  const { openConversation, sendMessage } = await import('@/src/lib/chat');
  const conversationId = await openConversation(booking.apartments as Apartment, booking.student_id);
  await sendMessage(conversationId, senderId, body);
  return conversationId;
}

export async function detachCancelledStayChat(booking: Pick<Booking, 'apartment_id' | 'student_id'>) {
  if (!booking.apartment_id || !booking.student_id) return;
  await hideListingConversation(booking.apartment_id, booking.student_id);
}

export async function applyStayExtension(booking: Booking, extraMonths: number) {
  const patch = extendedStayPatch(booking, extraMonths);
  const { error } = await supabase.from('bookings').update(patch).eq('id', booking.id);
  if (error) throw error;
  return { ...booking, ...patch };
}
