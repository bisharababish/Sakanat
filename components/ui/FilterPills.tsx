import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export type FilterPillItem<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

export function FilterPills<T extends string>({
  value,
  onChange,
  values,
  onToggle,
  items,
  allowDeselect,
  compact,
}: {
  value?: T;
  onChange?: (next: T) => void;
  values?: readonly T[];
  onToggle?: (next: T) => void;
  items: FilterPillItem<T>[];
  allowDeselect?: boolean;
  compact?: boolean;
}) {
  const { isRtl } = useLayout();
  const colors = useColors();

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        { justifyContent: isRtl ? 'flex-end' : 'flex-start' },
      ]}
    >
      {items.map((item) => {
        const on = values ? values.includes(item.value) : value === item.value;
        return (
          <Pressable
            key={item.value}
            onPress={() => {
              if (onToggle) {
                onToggle(item.value);
                return;
              }
              if (!onChange) return;
              if (allowDeselect && value === item.value) onChange('' as T);
              else onChange(item.value);
            }}
            style={[
              styles.pill,
              compact && styles.pillCompact,
              {
                backgroundColor: on ? colors.primary : colors.surface,
                borderColor: on ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[styles.label, compact && styles.labelCompact, { color: on ? colors.white : colors.text }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.count != null ? (
              <Text style={[styles.count, compact && styles.countCompact, { color: on ? colors.white : colors.textMuted }]}>
                {item.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: '100%' },
  wrapCompact: { gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingVertical: 9,
    paddingHorizontal: 14,
    maxWidth: '100%',
    flexShrink: 1,
  },
  pillCompact: {
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  label: { fontSize: 13, fontFamily: 'Cairo_700Bold', flexShrink: 1, letterSpacing: -0.1 },
  labelCompact: { fontSize: 12 },
  count: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  countCompact: { fontSize: 11 },
});
