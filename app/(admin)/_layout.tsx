import { Stack } from 'expo-router';

import { useColors } from '@/src/theme/ThemeProvider';

export default function AdminLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
