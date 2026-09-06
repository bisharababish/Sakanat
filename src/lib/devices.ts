import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { fetchPublicIp } from '@/src/lib/trust';
import { supabase } from '@/src/lib/supabase';
import type { DeviceSession } from '@/src/types/database';

function decodeSessionKey(accessToken?: string | null) {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(normalized)) as { session_id?: string; sub?: string };
    return json.session_id || json.sub || null;
  } catch {
    return null;
  }
}

function deviceLabel() {
  const name = Constants.deviceName || Constants.expoConfig?.name || 'Device';
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  return `${name} · ${os}`;
}

export async function touchDeviceSession(userId: string) {
  const { data } = await supabase.auth.getSession();
  const key = decodeSessionKey(data.session?.access_token) ?? `local-${userId.slice(0, 8)}`;
  const ip = await fetchPublicIp();
  const row = {
    user_id: userId,
    session_key: key,
    device_label: deviceLabel(),
    platform: Platform.OS,
    last_ip: ip,
    last_seen_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('device_sessions').upsert(row, {
    onConflict: 'user_id,session_key',
  });
  if (error) throw error;
  return key;
}

export async function loadDeviceSessions(userId: string) {
  const { data, error } = await supabase
    .from('device_sessions')
    .select('id, user_id, session_key, device_label, platform, last_ip, last_seen_at, created_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as DeviceSession[];
}

export async function currentSessionKey() {
  const { data } = await supabase.auth.getSession();
  return decodeSessionKey(data.session?.access_token);
}
