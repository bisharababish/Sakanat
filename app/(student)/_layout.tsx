import { Stack } from 'expo-router';

import { useColors } from '@/src/theme/ThemeProvider';

export default function StudentLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
