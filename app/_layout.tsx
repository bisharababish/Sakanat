import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { BrandLoader } from '@/components/BrandLoader';
import { AuthProvider, useAuth } from '@/src/lib/auth';
import i18n, { applyRtl, loadSavedLanguage } from '@/src/i18n';
import { registerPushToken } from '@/src/lib/push';
import { homeHref } from '@/src/lib/routes';
import { colors } from '@/src/theme/colors';

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
      <StatusBar style="dark" />
      <SessionGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </SessionGuard>
    </AuthProvider>
  );
}

const AUTH_HOLD = new Set(['verify-email', 'confirmed', 'reset-password', 'forgot-password']);

function SessionGuard({ children }: { children: ReactNode }) {
  const { session, profile, loading, passwordRecovery } = useAuth();
  const segments = useSegments();
  const lastDest = useRef<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    void registerPushToken(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    if (loading) return;
    const group = String(segments[0] ?? '');
    const screen = String(segments[1] ?? '');
    const inAuth = group === '(auth)';
    const inApp = group === '(student)' || group === '(owner)' || group === '(admin)';

    let dest: string | null = null;
    if (passwordRecovery) {
      dest = screen === 'reset-password' ? null : '/(auth)/reset-password';
    } else if (session && profile) {
      if (inAuth && AUTH_HOLD.has(screen)) dest = null;
      else if (inApp) dest = null;
      else dest = homeHref(profile.role);
    } else if (!session && !inAuth) {
      dest = '/(auth)/welcome';
    }

    if (!dest || lastDest.current === dest) return;
    lastDest.current = dest;
    router.replace(dest as never);
  }, [session, profile, loading, segments, passwordRecovery]);

  if (loading) return <BrandLoader />;
  return children;
}
