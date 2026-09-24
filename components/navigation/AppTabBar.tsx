import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export const TAB_PILL_W = 44;
export const TAB_PILL_H = 32;

type TabRoute = { key: string; name: string; params?: object };

type Props = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarLabel?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
        tabBarBadge?: number | string | boolean;
        tabBarBadgeStyle?: object;
        tabBarAccessibilityLabel?: string;
      };
    }
  >;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

export function AppTabBar({ state, descriptors, navigation }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const count = Math.max(state.routes.length, 1);
  const [rowW, setRowW] = useState(windowWidth);
  const pillX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const tabW = rowW / count;
  const target = tabW * state.index + Math.max(0, (tabW - TAB_PILL_W) / 2);

  useEffect(() => {
    if (!placed.current) {
      pillX.setValue(target);
      placed.current = true;
      return;
    }
    Animated.timing(pillX, {
      toValue: target,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [pillX, target]);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          paddingBottom: Math.max(insets.bottom, 8),
          shadowColor: colors.text,
        },
      ]}
    >
      <View
        collapsable={false}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next > 0 && Math.abs(next - rowW) > 1) setRowW(next);
        }}
        style={styles.row}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              backgroundColor: colors.primary,
              transform: [{ translateX: pillX }],
            },
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const badge = options.tabBarBadge;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;
                if (!focused) navigation.navigate(route.name, route.params);
              }}
              style={styles.item}
            >
              <View style={styles.iconSlot}>
                {options.tabBarIcon?.({
                  focused,
                  color: focused ? colors.white : colors.textMuted,
                  size: 22,
                })}
                {badge != null && badge !== false ? (
                  <View style={[styles.badge, { backgroundColor: colors.danger }, options.tabBarBadgeStyle]}>
                    <Text style={[styles.badgeText, { color: colors.white }]}>
                      {typeof badge === 'number' && badge > 9 ? '9+' : String(badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color: focused ? colors.primary : colors.textMuted }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -6 },
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'flex-start',
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 2,
    left: 0,
    zIndex: 0,
    width: TAB_PILL_W,
    height: TAB_PILL_H,
    borderRadius: radius.md,
  },
  item: {
    flex: 1,
    zIndex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  iconSlot: {
    width: TAB_PILL_W,
    height: TAB_PILL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    end: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
});
