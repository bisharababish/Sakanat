import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/src/lib/supabase';

let handlerReady = false;

async function ensureNotifications() {
  const Notifications = await import('expo-notifications');
  if (!handlerReady) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerReady = true;
  }
  return Notifications;
}

export async function registerPushToken(userId: string) {
  try {
    if (Platform.OS === 'web') return;
    const Notifications = await ensureNotifications();
    const current = await Notifications.getPermissionsAsync();
    const next =
      current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
    if (next.status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
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
      body: JSON.stringify({ to: token, title, body, sound: 'default' }),
    });
  } catch {
    // Push is optional.
  }
}
