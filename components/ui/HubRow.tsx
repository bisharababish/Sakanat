import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function HubRow({
  icon,
  label,
  hint,
  dot,
  danger,
  trailing,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  dot?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const { row, rtlText, isRtl } = useLayout();
  const colors = useColors();
  const tint = danger ? colors.danger : colors.primary;
  const scale = useRef(new Animated.Value(1)).current;

  const inner = (
    <View style={[styles.rowInner, row]}>
      <View style={[styles.iconWrap, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, rtlText, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <View style={styles.trail}>
          {dot ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
          {onPress ? <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={tint} /> : null}
        </View>
      )}
    </View>
  );

  const cardStyle = [
    styles.rowCard,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      shadowColor: colors.text,
    },
  ];

  if (!onPress) {
    return <View style={cardStyle}>{inner}</View>;
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          Animated.timing(scale, { toValue: 0.96, duration: 110, useNativeDriver: true }).start(() => {
            onPress();
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }).start();
          });
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [...cardStyle, pressed ? styles.pressed : null]}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: { opacity: 0.92 },
  rowInner: { alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 15, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
