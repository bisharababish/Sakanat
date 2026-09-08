import { router } from 'expo-router';

import type { UserRole } from '@/src/types/database';

export type PushRouteData = {
  kind?: string;
  bookingId?: string;
  conversationId?: string;
  apartmentId?: string;
  reportId?: string;
};

export function routeFromPushData(data: PushRouteData | null | undefined, role?: UserRole | null) {
  if (!data?.kind || !role || role === 'admin') {
    if (data?.kind === 'report' && role === 'admin') {
      router.push('/(admin)/reports');
      return;
    }
    if (role === 'admin') return;
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
    if (role === 'owner') router.push('/(owner)/(tabs)/bookings');
    else router.push('/(student)/(tabs)/bookings');
    return;
  }

  if ((kind === 'listing' || kind === 'review') && data.apartmentId) {
    if (role === 'owner') {
      router.push({ pathname: '/(owner)/apartment/[id]', params: { id: data.apartmentId } });
    } else {
      router.push({ pathname: '/(student)/apartment/[id]', params: { id: data.apartmentId } });
    }
    return;
  }

  if (kind === 'review') {
    router.push('/(student)/(tabs)/bookings');
    return;
  }

  if (kind === 'report') {
    router.push({ pathname: '/(student)/(tabs)/profile', params: { tab: 'settings' } });
  }
}
