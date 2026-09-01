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
}: {
  value?: T;
  onChange?: (next: T) => void;
  values?: readonly T[];
  onToggle?: (next: T) => void;
  items: FilterPillItem<T>[];
  allowDeselect?: boolean;
}) {
  const { row } = useLayout();
  const colors = useColors();

  return (
    <View style={[styles.wrap, row]}>
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
              row,
              {
                backgroundColor: on ? colors.primary : colors.surface,
                borderColor: on ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: on ? colors.white : colors.text }]}>{item.label}</Text>
            {item.count != null ? (
              <Text style={[styles.count, { color: on ? colors.white : colors.textMuted }]}>{item.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexWrap: 'wrap', gap: 8 },
  pill: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  label: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  count: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
});
