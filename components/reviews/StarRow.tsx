import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '@/src/theme/ThemeProvider';

export function StarRow({
  value,
  size = 18,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (next: number) => void;
}) {
  const colors = useColors();
  const filled = Math.round(value);

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const icon = (
          <Ionicons
            name={star <= filled ? 'star' : 'star-outline'}
            size={size}
            color={star <= filled ? colors.warning : colors.textMuted}
          />
        );
        if (!onChange) return <View key={star}>{icon}</View>;
        return (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={6} accessibilityRole="button">
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
