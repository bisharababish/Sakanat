import { Animated } from 'react-native';

import { AppTabBar } from '@/components/navigation/AppTabBar';
import { useColors } from '@/src/theme/ThemeProvider';

export function useAppTabScreenOptions() {
  const colors = useColors();
  return {
    headerShown: false,
    tabBarHideOnKeyboard: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    freezeOnBlur: true,
    animation: 'shift' as const,
    transitionSpec: {
      animation: 'spring' as const,
      config: { friction: 8, tension: 72 },
    },
    sceneStyleInterpolator: ({
      current,
    }: {
      current: { progress: Animated.AnimatedInterpolation<number> };
    }) => ({
      sceneStyle: {
        opacity: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0, 1, 0],
        }),
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-28, 0, 28],
            }),
          },
        ],
      },
    }),
    tabBar: (props: Parameters<typeof AppTabBar>[0]) => <AppTabBar {...props} />,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 0,
    },
  };
}

