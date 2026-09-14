import { Stack } from 'expo-router';

import { AdminPendingProvider } from '@/src/hooks/useAdminPendingCounts';
import { useColors } from '@/src/theme/ThemeProvider';

export default function AdminLayout() {
  const colors = useColors();
  return (
    <AdminPendingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'ios_from_right',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      </Stack>
    </AdminPendingProvider>
  );
}
