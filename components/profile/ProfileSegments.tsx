import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export type ProfileTabItem<T extends string> = {
  key: T;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  badge?: number;
  dot?: boolean;
};

type Props<T extends string> = {
  tabs: ProfileTabItem<T>[];
  value: T;
  onChange: (key: T) => void;
};

export function ProfileSegments<T extends string>({ tabs, value, onChange }: Props<T>) {
  const { row } = useLayout();
  const colors = useColors();

  return (
    <View style={[styles.track, row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {tabs.map((item) => {
        const active = value === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={[
              styles.segment,
              active ? { backgroundColor: colors.primary } : null,
            ]}
          >
            <Ionicons name={item.icon} size={16} color={active ? colors.white : colors.primary} />
            <Text
              style={[styles.segLabel, { color: active ? colors.white : colors.text }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.dot ? (
              <View
                style={[
                  styles.segDot,
                  { backgroundColor: colors.danger, borderColor: active ? colors.primary : colors.surface },
                ]}
              />
            ) : item.badge ? (
              <View style={[styles.segBadge, { backgroundColor: active ? colors.accent : colors.primarySoft }]}>
                <Text style={[styles.segBadgeText, { color: colors.primaryDark }]}>{item.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  segLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
  },
  segBadge: {
    position: 'absolute',
    top: 4,
    end: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBadgeText: { fontSize: 10, fontWeight: '800' },
  segDot: {
    position: 'absolute',
    top: 6,
    end: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
});
