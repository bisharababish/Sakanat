import { Platform } from 'react-native';

import { useColors } from '@/src/theme/ThemeProvider';

export function useAppTabScreenOptions() {
  const colors = useColors();
  return {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      paddingTop: 8,
      ...Platform.select({
        ios: {
          shadowColor: colors.text,
          shadowOpacity: 0.1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -8 },
        },
        android: { elevation: 16 },
        default: {},
      }),
    },
    tabBarLabelStyle: {
      fontFamily: 'Cairo_700Bold',
      fontSize: 11,
      fontWeight: '700' as const,
      marginTop: 2,
      marginBottom: 2,
    },
    tabBarItemStyle: {
      paddingTop: 2,
    },
  };
}
