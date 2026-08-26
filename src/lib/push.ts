import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

const PUSH_KEY = 'sakanat.push';
const PUSH_ASKED_KEY = 'sakanat.push.asked';

let handlerReady = false;

async function ensureNotifications() {
  const Notifications = await import('expo-notifications');
  if (!handlerReady) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerReady = true;
  }
  return Notifications;
}

async function ensureAndroidChannel(Notifications: typeof import('expo-notifications')) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Bookings and chat',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2D5A3D',
  });
}

export async function getPushEnabled() {
  const saved = await AsyncStorage.getItem(PUSH_KEY);
  return saved !== 'off';
}

export async function wasPushPrompted() {
  return (await AsyncStorage.getItem(PUSH_ASKED_KEY)) === '1';
}

export async function markPushPrompted() {
  await AsyncStorage.setItem(PUSH_ASKED_KEY, '1');
}

export async function getNotificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const Notifications = await ensureNotifications();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return 'granted';
    if (current.status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'denied';
  }
}

export async function setPushEnabled(on: boolean, userId?: string) {
  await AsyncStorage.setItem(PUSH_KEY, on ? 'on' : 'off');
  if (!userId) return;
  if (on) {
    await registerPushToken(userId, true);
    return;
  }
  await supabase.from('profiles').update({ expo_push_token: null }).eq('id', userId);
}

export async function requestPushAndRegister(userId: string) {
  await AsyncStorage.setItem(PUSH_KEY, 'on');
  await registerPushToken(userId, true);
}

export async function syncPushToken(userId: string) {
  await registerPushToken(userId, false);
}

export async function registerPushToken(userId: string, requestPermission = false) {
  try {
    if (Platform.OS === 'web') return;
    if (!(await getPushEnabled())) return;
    const Notifications = await ensureNotifications();
    await ensureAndroidChannel(Notifications);
    const current = await Notifications.getPermissionsAsync();
    const next =
      current.status === 'granted' || current.granted
        ? current
        : requestPermission
          ? await Notifications.requestPermissionsAsync()
          : current;
    if (next.status !== 'granted' && !next.granted) return;
    const projectId =
      Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? undefined;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token.data) return;
    await supabase.from('profiles').update({ expo_push_token: token.data }).eq('id', userId);
  } catch {
    // Expo Go / missing column / permission — booking still works without push.
  }
}

export async function notifyUser(userId: string, title: string, body: string) {
  try {
    const { data } = await supabase.from('profiles').select('expo_push_token').eq('id', userId).maybeSingle();
    const token = data?.expo_push_token;
    if (!token) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', channelId: 'default' }),
    });
  } catch {
    // Push is optional.
  }
}
