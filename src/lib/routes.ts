import type { UserRole } from '@/src/types/database';

export function homeHref(role: UserRole) {
  if (role === 'admin') return '/(admin)/(tabs)';
  if (role === 'owner') return '/(owner)/(tabs)/listings';
  return '/(student)/(tabs)/search';
}
