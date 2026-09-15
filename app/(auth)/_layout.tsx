import { Stack } from 'expo-router';

import { useColors } from '@/src/theme/ThemeProvider';

export default function AuthLayout() {
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
      <Stack.Screen name="mfa" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="mfa-enroll" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
    </Stack>
  );
}
