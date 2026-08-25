import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/src/theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  focused: boolean;
  outline: IconName;
  filled: IconName;
};

export function TabIcon({ focused, outline, filled }: Props) {
  return (
    <View style={[styles.wrap, focused && styles.wrapOn]}>
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
  wrapOn: {
    backgroundColor: colors.primary,
  },
});
