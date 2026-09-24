import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export const TAB_ICON_W = 48;
export const TAB_ICON_H = 34;

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  focused: boolean;
  outline: IconName;
  filled: IconName;
};

/** Active tab mark — green pill lives here so it always shows. */
export function TabIcon({ focused, outline, filled }: Props) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.wrap,
        focused ? { backgroundColor: colors.primary } : null,
      ]}
    >
      <Ionicons
        name={focused ? filled : outline}
        size={22}
        color={focused ? colors.white : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: TAB_ICON_W,
    height: TAB_ICON_H,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
