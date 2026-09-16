import { router } from 'expo-router';
import * as Linking from 'expo-linking';

import type { UserRole } from '@/src/types/database';

export type PushRouteData = {
  kind?: string;
  bookingId?: string;
  conversationId?: string;
  apartmentId?: string;
  reportId?: string;
};

export function listingShareUrl(apartmentId: string) {
  return Linking.createURL(`apartment/${apartmentId}`);
}

export function routeFromPushData(data: PushRouteData | null | undefined, role?: UserRole | null) {
  if (!data?.kind || !role) {
    if (data?.apartmentId) {
      router.push({ pathname: '/(student)/apartment/[id]', params: { id: data.apartmentId } });
    }
    return;
  }

  if (role === 'admin') {
    if (data.kind === 'report') {
      router.push('/(admin)/reports');
      return;
    }
    if (data.kind === 'chat' && data.conversationId) {
      router.push({ pathname: '/(admin)/conversation/[id]', params: { id: data.conversationId } });
      return;
    }
    if (data.kind === 'booking') {
      router.push('/(admin)/(tabs)/bookings');
      return;
    }
    if ((data.kind === 'listing' || data.kind === 'review') && data.apartmentId) {
      router.push({ pathname: '/(admin)/apartment/[id]', params: { id: data.apartmentId } });
      return;
    }
    if (data.kind === 'chat') {
      router.push('/(admin)/(tabs)/chat');
    }
    return;
  }

  const kind = data.kind;
  if (kind === 'chat' && data.conversationId) {
    if (role === 'owner') {
      router.push({ pathname: '/(owner)/conversation/[id]', params: { id: data.conversationId } });
    } else {
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: data.conversationId } });
    }
    return;
  }

  if (kind === 'booking') {
    if (role === 'owner') {
      router.push({
        pathname: '/(owner)/(tabs)/bookings',
        params: data.bookingId ? { focus: data.bookingId } : undefined,
      });
    } else {
      router.push({
        pathname: '/(student)/(tabs)/bookings',
        params: data.bookingId ? { focus: data.bookingId, review: data.bookingId } : undefined,
      });
    }
    return;
  }

  if ((kind === 'listing' || kind === 'review') && data.apartmentId) {
    if (role === 'owner') {
      router.push({ pathname: '/(owner)/apartment/[id]', params: { id: data.apartmentId } });
    } else if (kind === 'review' && data.bookingId) {
      router.push({
        pathname: '/(student)/(tabs)/bookings',
        params: { focus: data.bookingId, review: data.bookingId },
      });
    } else {
      router.push({
        pathname: '/(student)/apartment/[id]',
        params: { id: data.apartmentId, focus: kind === 'review' ? 'reviews' : undefined },
      });
    }
    return;
  }

  if (kind === 'review') {
    router.push({
      pathname: '/(student)/(tabs)/bookings',
      params: data.bookingId ? { focus: data.bookingId, review: data.bookingId } : undefined,
    });
    return;
  }

  if (kind === 'report') {
    if (role === 'owner') {
      router.push('/(owner)/(tabs)/profile');
      return;
    }
    router.push('/(student)/(tabs)/profile');
  }
}

export function apartmentIdFromAppUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const parts = (parsed.path ?? '').split('/').filter(Boolean);
    const aptIdx = parts.findIndex((part) => part === 'apartment');
    const id = aptIdx >= 0 ? parts[aptIdx + 1] : null;
    return id || null;
  } catch {
    return null;
  }
}

/** Handle sakanat://apartment/{id} (and exp://…/apartment/{id}) share links. */
export function routeFromAppUrl(url: string | null | undefined, role?: UserRole | null) {
  const id = apartmentIdFromAppUrl(url);
  if (!id) return false;
  if (role === 'owner') {
    router.push({ pathname: '/(owner)/apartment/[id]', params: { id } });
  } else if (role === 'admin') {
    router.push({ pathname: '/(admin)/apartment/[id]', params: { id } });
  } else if (role === 'student' || role === 'renter') {
    router.push({ pathname: '/(student)/apartment/[id]', params: { id } });
  } else {
    router.push({ pathname: '/(guest)/apartment/[id]', params: { id } });
  }
  return true;
}
