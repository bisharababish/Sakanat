import { Stack } from 'expo-router';

import { AdminPendingProvider } from '@/src/hooks/useAdminPendingCounts';
import { useColors } from '@/src/theme/ThemeProvider';

export default function AdminLayout() {
  const colors = useColors();
  return (
    <AdminPendingProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AdminPendingProvider>
  );
}
