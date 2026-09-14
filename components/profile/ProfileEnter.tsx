import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { spacing } from '@/src/theme/colors';

export function ProfileEnter({
  scene,
  reverse = false,
  enterOnMount = false,
  children,
}: {
  scene: string;
  reverse?: boolean;
  enterOnMount?: boolean;
  children: ReactNode;
}) {
  const { isRtl } = useLayout();
  const progress = useRef(new Animated.Value(enterOnMount ? 0 : 1)).current;
  const first = useRef(true);

  useEffect(() => {
    const play = () => {
      progress.setValue(0);
      if (reverse) {
        Animated.timing(progress, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(progress, {
          toValue: 1,
          useNativeDriver: true,
          friction: 9,
          tension: 80,
        }).start();
      }
    };
    if (first.current) {
      first.current = false;
      if (enterOnMount) play();
      else progress.setValue(1);
      return;
    }
    play();
  }, [enterOnMount, progress, reverse, scene]);

  const dir = (isRtl ? -1 : 1) * (reverse ? -1 : 1);
  const from = reverse ? 16 : 28;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [from * dir, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
});
