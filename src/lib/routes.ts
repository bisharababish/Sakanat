import type { UserRole } from '@/src/types/database';

export function homeHref(role: UserRole) {
  if (role === 'admin') return '/(admin)/(tabs)';
  if (role === 'owner') return '/(owner)/(tabs)/listings';
  return '/(student)/(tabs)/search';
}

export function profileHref(role: UserRole) {
  if (role === 'admin') return '/(admin)/(tabs)/settings';
  if (role === 'owner') return '/(owner)/(tabs)/profile';
  return '/(student)/(tabs)/profile';
}
