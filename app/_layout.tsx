import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold, useFonts } from '@expo-google-fonts/cairo';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/src/lib/auth';
import i18n, { applyRtl, loadSavedLanguage } from '@/src/i18n';
import { colors } from '@/src/theme/colors';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

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
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready, fontsLoaded]);

  if (!ready) return null;

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

function SessionGuard({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (session && profile && inAuth) {
      const screen = String(segments[1] ?? '');
      if (screen !== 'verify-email' && screen !== 'confirmed') {
        router.replace('/');
      }
      return;
    }
    if (!session && !inAuth) {
      router.replace('/(auth)/welcome');
    }
  }, [session, profile, loading, segments]);

  return children;
}
