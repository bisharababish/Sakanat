import type { UserRole } from '@/src/types/database';

export function homeHref(role: UserRole) {
  if (role === 'admin') return '/(admin)/(tabs)';
  if (role === 'owner') return '/(owner)/(tabs)/listings';
  return '/(student)/(tabs)/search';
}

export type StudentProfileTab = 'account' | 'trust' | 'saved' | 'security';

export function profileHref(role: UserRole, tab?: StudentProfileTab) {
  if (role === 'admin') return '/(admin)/(tabs)/settings';
  if (role === 'owner') return '/(owner)/(tabs)/profile';
  return tab ? { pathname: '/(student)/(tabs)/profile' as const, params: { tab } } : '/(student)/(tabs)/profile';
}

export function allowedAppGroup(role: UserRole, group: string) {
  if (group === '(admin)') return role === 'admin';
  if (group === '(owner)') return role === 'owner';
  if (group === '(student)') return role === 'student' || role === 'renter';
  return false;
}
