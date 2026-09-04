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
import { PushPrompt } from '@/components/PushPrompt';
import { IdleGuard } from '@/src/hooks/useIdleLogout';
import { isSuspended } from '@/src/lib/moderation';
import { syncPushToken } from '@/src/lib/push';
import { allowedAppGroup, homeHref } from '@/src/lib/routes';
import { ThemeProvider, useColors, useTheme } from '@/src/theme/ThemeProvider';

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
          <MenuProvider>
            <ThemedStatusBar />
            <SessionGuard>
              <AppStack />
              <PushPrompt />
            </SessionGuard>
          </MenuProvider>
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
      }}
    />
  );
}

function SessionGuard({ children }: { children: ReactNode }) {
  const { session, profile, loading, passwordRecovery, mfaPending, mfaEnrollRequired, signOut } = useAuth();
  const segments = useSegments();
  const lastDest = useRef<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    if (isSuspended(profile)) {
      void signOut();
      return;
    }
    void syncPushToken(profile.id);
  }, [profile, signOut]);

  useEffect(() => {
    if (loading) return;
    const group = String(segments[0] ?? '');
    const screen = String(segments[1] ?? '');
    const inAuth = group === '(auth)';
    const inGuest = group === '(guest)';
    const inApp = group === '(student)' || group === '(owner)' || group === '(admin)';

    let dest: string | null = null;
    if (passwordRecovery) {
      dest = screen === 'reset-password' ? null : '/(auth)/reset-password';
    } else if (mfaPending) {
      dest = screen === 'mfa' ? null : '/(auth)/mfa';
    } else if (mfaEnrollRequired) {
      dest = screen === 'mfa-enroll' ? null : '/(auth)/mfa-enroll';
    } else if (session && profile) {
      if (inApp && allowedAppGroup(profile.role, group)) dest = null;
      else if (inAuth && screen === 'forgot-password') dest = null;
      else dest = homeHref(profile.role);
    } else if (!session && !inAuth && !inGuest) {
      dest = '/(auth)/welcome';
    }

    if (!dest) {
      lastDest.current = null;
      return;
    }
    const token = `${dest}|${group}|${screen}`;
    if (lastDest.current === token) return;
    lastDest.current = token;
    router.replace(dest as never);
  }, [session, profile, loading, segments, passwordRecovery, mfaPending, mfaEnrollRequired]);

  const group = String(segments[0] ?? '');
  const inApp = group === '(student)' || group === '(owner)' || group === '(admin)';
  const covering =
    loading ||
    (Boolean(session && profile) &&
      !passwordRecovery &&
      !mfaPending &&
      !mfaEnrollRequired &&
      !inApp);

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
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
});
