import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandLoader } from '@/components/BrandLoader';
import { MenuProvider } from '@/components/menu/MenuProvider';
import { AuthProvider, useAuth } from '@/src/lib/auth';
import i18n, { applyRtl, loadSavedLanguage } from '@/src/i18n';
import { NoticeProvider } from '@/src/lib/notice';
import { EdgeBackProvider } from '@/src/hooks/useEdgeBack';
import { PushPrompt } from '@/components/PushPrompt';
import { IdleGuard } from '@/src/hooks/useIdleLogout';
import { isSuspended } from '@/src/lib/moderation';
import { syncPushToken } from '@/src/lib/push';
import {
  apartmentIdFromAppUrl,
  routeFromAppUrl,
  routeFromPushData,
  type PushRouteData,
} from '@/src/lib/pushRouting';
import { maybeRunBookingOps, syncSearchAlertOnLogin } from '@/src/lib/searchAlerts';
import { flushChatOutbox } from '@/src/lib/chatOutbox';
import { allowedAppGroup, homeHref } from '@/src/lib/routes';
import {
  hydrateGuestApartment,
  rememberGuestApartment,
  subscribeGuestApartment,
  takeGuestApartment,
} from '@/src/lib/guest';
import { ThemeProvider, useColors, useTheme } from '@/src/theme/ThemeProvider';
import { OnboardingGate } from '@/components/OnboardingGate';
import * as Linking from 'expo-linking';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

const MIN_BRAND_MS = 1600;

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [held, setHeld] = useState(false);
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });

  useEffect(() => {
    const boot = async () => {
      try {
        const language = await loadSavedLanguage();
        applyRtl(language);
        await i18n.changeLanguage(language);
      } finally {
        setReady(true);
      }
    };
    void boot();
    const timeout = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setHeld(true), MIN_BRAND_MS);
    return () => clearTimeout(timeout);
  }, []);

  if (!fontsLoaded || !ready || !held) {
    return <BrandLoader />;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <NoticeProvider>
          <EdgeBackProvider>
          <MenuProvider>
            <ThemedStatusBar />
            <SessionGuard>
              <AppStack />
              <PushPrompt />
              <OnboardingGate />
            </SessionGuard>
          </MenuProvider>
          </EdgeBackProvider>
        </NoticeProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function AppStack() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'ios_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="(student)" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="(owner)" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="(admin)" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="(guest)" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
    </Stack>
  );
}

function SessionGuard({ children }: { children: ReactNode }) {
  const { session, profile, loading, passwordRecovery, mfaPending, mfaEnrollRequired, signOut } = useAuth();
  const segments = useSegments();
  const lastDest = useRef<string | null>(null);
  const [guestApt, setGuestApt] = useState<string | null>(null);
  const [linkReady, setLinkReady] = useState(false);

  useEffect(() => {
    if (!profile?.id || mfaPending || mfaEnrollRequired) return;
    if (isSuspended(profile)) {
      void signOut();
      return;
    }
    void syncPushToken(profile.id);
    void maybeRunBookingOps();
    void flushChatOutbox();
    void syncSearchAlertOnLogin();
  }, [profile, mfaPending, mfaEnrollRequired, signOut]);

  useEffect(() => {
    if (!profile?.id) return;
    let sub: { remove: () => void } | undefined;
    void Linking.getInitialURL().then((url) => {
      if (url) routeFromAppUrl(url, profile.role);
    });
    sub = Linking.addEventListener('url', ({ url }) => {
      routeFromAppUrl(url, profile.role);
    });
    return () => sub?.remove();
  }, [profile?.id, profile?.role]);

  useEffect(() => subscribeGuestApartment(setGuestApt), []);

  useEffect(() => {
    void hydrateGuestApartment();
  }, []);

  useEffect(() => {
    if (session) {
      setLinkReady(true);
      return;
    }
    let alive = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (!alive) return;
        const id = apartmentIdFromAppUrl(url);
        if (id) rememberGuestApartment(id);
      })
      .finally(() => {
        if (alive) setLinkReady(true);
      });
    const sub = Linking.addEventListener('url', ({ url }) => {
      const id = apartmentIdFromAppUrl(url);
      if (id) rememberGuestApartment(id);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [session]);

  useEffect(() => {
    if (!profile?.id || profile.role === 'admin') return;
    let sub: { remove: () => void } | undefined;
    let alive = true;
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const open = (data: PushRouteData) => routeFromPushData(data, profile.role);
        const last = await Notifications.getLastNotificationResponseAsync();
        if (alive && last?.notification.request.content.data) {
          open(last.notification.request.content.data as PushRouteData);
        }
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          open((response.notification.request.content.data ?? {}) as PushRouteData);
        });
      } catch {
        // Expo Go / web — optional.
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    if (loading) return;
    const group = String(segments[0] ?? '');
    const screen = String(segments[1] ?? '');
    const inAuth = group === '(auth)';
    const inGuest = group === '(guest)';
    const inApp = group === '(student)' || group === '(owner)' || group === '(admin)';
    const onGuestListing = inGuest && screen === 'apartment';

    let dest: string | { pathname: string; params: { id: string } } | null = null;
    if (passwordRecovery) {
      dest = screen === 'reset-password' ? null : '/(auth)/reset-password';
    } else if (mfaPending) {
      dest = screen === 'mfa' ? null : '/(auth)/mfa';
    } else if (mfaEnrollRequired) {
      dest = screen === 'mfa-enroll' ? null : '/(auth)/mfa-enroll';
    } else if (session && profile) {
      const seeker = profile.role === 'student' || profile.role === 'renter';
      const onSeekerListing = group === '(student)' && screen === 'apartment';
      if (seeker && guestApt && !onSeekerListing && !mfaPending && !mfaEnrollRequired) {
        dest = { pathname: '/(student)/apartment/[id]', params: { id: guestApt } };
      } else if (inApp && allowedAppGroup(profile.role, group)) dest = null;
      else if (inAuth && (screen === 'forgot-password' || screen === 'confirmed')) dest = null;
      else dest = homeHref(profile.role);
      if (seeker && guestApt && onSeekerListing) takeGuestApartment();
    } else if (!session) {
      if (!linkReady) return;
      if (inApp) {
        dest = '/(auth)/welcome';
      } else if (guestApt && !onGuestListing) {
        dest = { pathname: '/(guest)/apartment/[id]', params: { id: guestApt } };
      } else if (inGuest) {
        dest = null;
      } else if (inAuth && screen !== 'mfa' && screen !== 'mfa-enroll') {
        dest = null;
      } else {
        dest = '/(auth)/welcome';
      }
      if (onGuestListing && guestApt) takeGuestApartment();
    }

    if (!dest) {
      lastDest.current = null;
      return;
    }
    const destToken = typeof dest === 'string' ? dest : JSON.stringify(dest);
    const token = `${destToken}|${group}|${screen}`;
    if (lastDest.current === token) return;
    lastDest.current = token;
    router.replace(dest as never);
  }, [session, profile, loading, segments, passwordRecovery, mfaPending, mfaEnrollRequired, guestApt, linkReady]);

  const group = String(segments[0] ?? '');
  const screen = String(segments[1] ?? '');
  const inApp = group === '(student)' || group === '(owner)' || group === '(admin)';
  const inGuest = group === '(guest)';
  const inAuth = group === '(auth)';
  const stayOnAuth = inAuth && (screen === 'confirmed' || screen === 'forgot-password');
  const covering =
    loading ||
    (!session && inApp) ||
    (!session && inAuth && (screen === 'mfa' || screen === 'mfa-enroll')) ||
    (Boolean(session) &&
      (mfaPending || mfaEnrollRequired) &&
      screen !== 'mfa' &&
      screen !== 'mfa-enroll') ||
    (!session && !linkReady && !inGuest) ||
    (Boolean(session && profile) &&
      !passwordRecovery &&
      !mfaPending &&
      !mfaEnrollRequired &&
      !inApp &&
      !inGuest &&
      !stayOnAuth);

  return (
    <IdleGuard>
      {children}
      {covering ? (
        <View style={styles.cover} pointerEvents="auto">
          <BrandLoader />
        </View>
      ) : null}
    </IdleGuard>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
});
