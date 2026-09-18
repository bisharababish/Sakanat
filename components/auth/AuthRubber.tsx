import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const RUBBER = 56;
const SPRING = { damping: 18, stiffness: 220 };

function rubberY(dy: number) {
  const sign = dy < 0 ? -1 : 1;
  return sign * RUBBER * (1 - Math.exp(-Math.abs(dy) / 90));
}

export function AuthRubber({
  children,
  pan = true,
  threshold = 6,
  nudge,
}: {
  children: ReactNode;
  pan?: boolean;
  threshold?: number;
  nudge?: number | string;
}) {
  const pull = useSharedValue(0);
  const firstNudge = useRef(true);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));

  useEffect(() => {
    if (nudge == null) return;
    if (firstNudge.current) {
      firstNudge.current = false;
      return;
    }
    pull.value = rubberY(28);
    pull.value = withSpring(0, SPRING);
  }, [nudge, pull]);

  const panHandlers = useMemo(() => {
    if (!pan) return {};
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > threshold && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        pull.value = rubberY(gesture.dy);
      },
      onPanResponderRelease: () => {
        pull.value = withSpring(0, SPRING);
      },
      onPanResponderTerminate: () => {
        pull.value = withSpring(0, SPRING);
      },
    }).panHandlers;
  }, [pan, pull, threshold]);

  return (
    <Animated.View collapsable={false} style={[styles.card, cardStyle]} {...panHandlers}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexShrink: 1 },
});
