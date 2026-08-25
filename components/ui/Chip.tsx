import { Pressable, StyleSheet, Text } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected, onPress }: Props) {
  const { writingDirection } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.selected : null]}>
      <Text style={[styles.label, selected ? styles.selectedLabel : null, { writingDirection }]} numberOfLines={1}>
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: { color: colors.text, fontWeight: '600', fontSize: 13 },
  selectedLabel: { color: colors.white },
});
