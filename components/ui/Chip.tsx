import { Pressable, StyleSheet, Text } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  compact?: boolean;
};

export function Chip({ label, selected, onPress, compact }: Props) {
  const { writingDirection } = useLayout();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          { color: selected ? colors.white : colors.text, writingDirection },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: { fontWeight: '600', fontSize: 13 },
  labelCompact: { fontSize: 12 },
});
