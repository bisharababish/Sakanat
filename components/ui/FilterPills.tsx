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
  stretch,
}: {
  value?: T;
  onChange?: (next: T) => void;
  values?: readonly T[];
  onToggle?: (next: T) => void;
  items: FilterPillItem<T>[];
  allowDeselect?: boolean;
  compact?: boolean;
  /** Equal-width pills in one row (good for 2-option choices). */
  stretch?: boolean;
}) {
  const { isRtl } = useLayout();
  const colors = useColors();

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        stretch && styles.wrapStretch,
        { justifyContent: stretch ? 'space-between' : isRtl ? 'flex-end' : 'flex-start' },
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
              stretch && styles.pillStretch,
              {
                backgroundColor: on ? colors.primary : colors.surface,
                borderColor: on ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                stretch && styles.labelStretch,
                { color: on ? colors.white : colors.text },
              ]}
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
  wrapStretch: { flexWrap: 'nowrap', width: '100%' },
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
  pillStretch: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: undefined,
    flexShrink: 0,
  },
  label: { fontSize: 13, fontFamily: 'Cairo_700Bold', flexShrink: 1, letterSpacing: -0.1 },
  labelCompact: { fontSize: 12 },
  labelStretch: { textAlign: 'center', flexShrink: 1 },
  count: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  countCompact: { fontSize: 11 },
});
