import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

export type ProfileTabItem<T extends string> = {
  key: T;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  badge?: number;
};

type Props<T extends string> = {
  tabs: ProfileTabItem<T>[];
  value: T;
  onChange: (key: T) => void;
};

export function ProfileSegments<T extends string>({ tabs, value, onChange }: Props<T>) {
  const { row } = useLayout();

  return (
    <View style={[styles.segments, row]}>
      {tabs.map((item) => {
        const active = value === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Ionicons name={item.icon} size={22} color={active ? colors.white : colors.primary} />
            {item.badge ? (
              <View style={styles.segBadge}>
                <Text style={styles.segBadgeText}>{item.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { gap: spacing.sm },
  segment: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segBadge: {
    position: 'absolute',
    top: 8,
    end: 18,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBadgeText: { color: colors.primaryDark, fontSize: 10, fontWeight: '800' },
});
