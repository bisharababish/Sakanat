import { type ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_ICON_H, TAB_ICON_W } from '@/components/navigation/TabIcon';
import { useColors } from '@/src/theme/ThemeProvider';

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
        tabBarItemStyle?: object | object[];
        tabBarAccessibilityLabel?: string;
        href?: string | null;
      };
    }
  >;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

function isHiddenTab(options: Props['descriptors'][string]['options']) {
  if (options.href === null) return true;
  const flat = StyleSheet.flatten(options.tabBarItemStyle) as { display?: string } | undefined;
  return flat?.display === 'none';
}

export function AppTabBar({ state, descriptors, navigation }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const visible = useMemo(
    () =>
      state.routes
        .map((route, index) => ({ route, index }))
        .filter(({ route }) => !isHiddenTab(descriptors[route.key]?.options ?? {})),
    [descriptors, state.routes],
  );

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
          shadowColor: colors.text,
        },
      ]}
    >
      <View style={styles.row}>
        {visible.map(({ route, index }) => {
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
              <Text
                style={[styles.label, { color: focused ? colors.primary : colors.textMuted }]}
                numberOfLines={1}
              >
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
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  iconSlot: {
    width: TAB_ICON_W,
    height: TAB_ICON_H,
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
