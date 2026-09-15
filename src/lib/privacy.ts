import type { BookingStatus, ContactVisibility, Profile } from '@/src/types/database';

export type ContactChannel = 'phone' | 'whatsapp';

/** Admin always sees contact. Counterparties only when visibility allows it. */
export function canShowSeekerContact(
  seeker:
    | Pick<Profile, 'phone_visibility' | 'whatsapp_visibility'>
    | null
    | undefined,
  channel: ContactChannel,
  opts?: { isAdmin?: boolean; bookingStatus?: BookingStatus | null },
) {
  if (opts?.isAdmin) return true;
  const visibility: ContactVisibility =
    channel === 'phone'
      ? seeker?.phone_visibility ?? 'booking'
      : seeker?.whatsapp_visibility ?? 'booking';
  if (visibility === 'none') return false;
  const status = opts?.bookingStatus;
  if (!status || status === 'cancelled') return false;
  if (visibility === 'booking') return true;
  return status === 'confirmed' || status === 'completed';
}

/** Same rules for showing an owner's phone/WhatsApp to a student/renter. */
export function canShowOwnerContact(
  owner:
    | Pick<Profile, 'phone_visibility' | 'whatsapp_visibility'>
    | null
    | undefined,
  channel: ContactChannel,
  opts?: { isAdmin?: boolean; bookingStatus?: BookingStatus | null },
) {
  return canShowSeekerContact(owner, channel, opts);
}

export function shouldShareEmergency(
  seeker: Pick<Profile, 'share_emergency'> | null | undefined,
  opts?: { isAdmin?: boolean },
) {
  if (opts?.isAdmin) return true;
  return seeker?.share_emergency !== false;
}

export function shouldShowLastSeen(
  seeker: Pick<Profile, 'hide_last_seen'> | null | undefined,
  opts?: { isAdmin?: boolean },
) {
  if (opts?.isAdmin) return true;
  return !seeker?.hide_last_seen;
}

export function shouldShowSavedCount(
  profile: Pick<Profile, 'hide_saved_count'> | null | undefined,
) {
  return !profile?.hide_saved_count;
}

export function contactVisibilityLabel(
  value: ContactVisibility | null | undefined,
  t: (key: string) => string,
) {
  if (value === 'confirmed') return t('profile.privacyWhenConfirmed');
  if (value === 'none') return t('profile.privacyHidden');
  return t('profile.privacyOnBooking');
}
