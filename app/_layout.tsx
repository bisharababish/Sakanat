import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';

import { BrandLoader } from '@/components/BrandLoader';
import { AuthProvider, useAuth } from '@/src/lib/auth';
import i18n, { applyRtl, loadSavedLanguage } from '@/src/i18n';
import { registerPushToken } from '@/src/lib/push';
import { colors } from '@/src/theme/colors';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  const [ready, setReady] = useState(false);
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
    if (ready && fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [ready, fontsLoaded]);

  if (!ready || !fontsLoaded) {
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

  useEffect(() => {
    if (!profile?.id) return;
    void registerPushToken(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const screen = String(segments[1] ?? '');
    if (passwordRecovery) {
      if (screen !== 'reset-password') router.replace('/(auth)/reset-password');
      return;
    }
    if (session && profile && inAuth) {
      if (!AUTH_HOLD.has(screen)) {
        router.replace('/');
      }
      return;
    }
    if (!session && !inAuth) {
      router.replace('/(auth)/welcome');
    }
  }, [session, profile, loading, segments, passwordRecovery]);

  if (loading) return <BrandLoader />;
  return children;
}
