import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  onPress: () => void;
};

export function ProfileBanner({ icon, text, onPress }: Props) {
  const { isRtl, textAlign, writingDirection } = useLayout();
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.accent }]}
    >
      <View style={[styles.bannerIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.bannerText, { textAlign, writingDirection, color: colors.text }]}>{text}</Text>
      <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
  },
});
