import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/src/theme/ThemeProvider';

const CHIP = 62;
const GAP = 7;
const EDGE = 10;
const OPEN = EDGE + CHIP * 3 + GAP * 2 + EDGE;
const SPRING = { damping: 24, stiffness: 280, mass: 0.7 };

type Props = {
  muted?: boolean;
  archived?: boolean;
  onMute: () => void;
  onArchive: () => void;
  onDelete: () => void;
  children: ReactNode | ((toggle: () => void) => ReactNode);
};

export function SwipeableConversation({ muted, archived, onMute, onArchive, onDelete, children }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const x = useSharedValue(0);
  const start = useSharedValue(0);

  const toggleJs = () => {
    const opened = x.value < -OPEN * 0.2;
    x.value = withSpring(opened ? 0 : -OPEN, SPRING);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-16, 16])
    .onBegin(() => {
      start.value = x.value;
    })
    .onUpdate((event) => {
      const next = start.value + event.translationX;
      x.value = Math.max(-OPEN, Math.min(0, next));
    })
    .onEnd((event) => {
      const shouldOpen = x.value < -OPEN * 0.3 || event.velocityX < -700;
      const shouldClose = event.velocityX > 700;
      if (shouldClose) x.value = withSpring(0, SPRING);
      else x.value = withSpring(shouldOpen ? -OPEN : 0, SPRING);
    });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-OPEN, -20, 0], [1, 0.95, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(x.value, [-OPEN, -40, 0], [1, 0.96, 0.88], Extrapolation.CLAMP),
      },
    ],
  }));

  const closeThen = (fn: () => void) => {
    fn();
    x.value = withSpring(0, SPRING);
  };

  const content = typeof children === 'function' ? children(toggleJs) : children;

  return (
    <View style={[styles.shell, { backgroundColor: colors.surfaceMuted }]}>
      <Animated.View style={[styles.actions, actionsStyle]} pointerEvents="box-none">
        <Pressable
          onPress={() => closeThen(onMute)}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: muted ? colors.success : colors.warning, opacity: pressed ? 0.88 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={muted ? t('chat.unmute') : t('chat.mute')}
        >
          <Ionicons name={muted ? 'notifications' : 'notifications-off'} size={20} color="#fff" />
          <Text style={styles.chipLabel} numberOfLines={1}>
            {muted ? t('chat.swipeUnmute') : t('chat.swipeMute')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => closeThen(onArchive)}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={archived ? t('chat.unarchive') : t('chat.archive')}
        >
          <Ionicons name={archived ? 'arrow-undo' : 'archive'} size={20} color="#fff" />
          <Text style={styles.chipLabel} numberOfLines={1}>
            {archived ? t('chat.swipeUnarchive') : t('chat.swipeArchive')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => closeThen(onDelete)}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: colors.danger, opacity: pressed ? 0.88 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('chat.deleteChat')}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.chipLabel} numberOfLines={1}>
            {t('chat.deleteChat')}
          </Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.front, { backgroundColor: colors.surface }, frontStyle]}>
          {content}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    minHeight: 70,
  },
  actions: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: EDGE,
  },
  chip: {
    width: CHIP,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  chipLabel: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  front: {
    minHeight: 70,
    zIndex: 2,
  },
});
