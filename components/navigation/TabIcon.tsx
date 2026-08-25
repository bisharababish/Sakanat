import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  focused: boolean;
  outline: IconName;
  filled: IconName;
};

export function TabIcon({ focused, outline, filled }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.wrap, focused && { backgroundColor: colors.primary }]}>
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? colors.white : colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 44,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
