import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { BrandLoader } from '@/components/BrandLoader';
import { MenuProvider } from '@/components/menu/MenuProvider';
import { AuthProvider, useAuth } from '@/src/lib/auth';
import i18n, { applyRtl, loadSavedLanguage } from '@/src/i18n';
import { NoticeProvider } from '@/src/lib/notice';
import { PushPrompt } from '@/components/PushPrompt';
import { isSuspended } from '@/src/lib/moderation';
import { syncPushToken } from '@/src/lib/push';
import { homeHref } from '@/src/lib/routes';
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
    if (!fontsLoaded) return;
    const timeout = setTimeout(() => setHeld(true), MIN_BRAND_MS);
    return () => clearTimeout(timeout);
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  if (!ready || !held) {
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

const AUTH_HOLD = new Set(['verify-email', 'confirmed', 'reset-password', 'forgot-password']);

function SessionGuard({ children }: { children: ReactNode }) {
  const { session, profile, loading, passwordRecovery, signOut } = useAuth();
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
    } else if (session && profile) {
      if (inAuth && AUTH_HOLD.has(screen)) dest = null;
      else if (inApp) dest = null;
      else dest = homeHref(profile.role);
    } else if (!session && !inAuth && !inGuest) {
      dest = '/(auth)/welcome';
    }

    if (!dest || lastDest.current === dest) return;
    lastDest.current = dest;
    router.replace(dest as never);
  }, [session, profile, loading, segments, passwordRecovery]);

  if (loading) return <BrandLoader />;
  return children;
}
