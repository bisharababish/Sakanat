import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  onPress: () => void;
};

export function ProfileBanner({ icon, text, onPress }: Props) {
  const { row, isRtl, textAlign, writingDirection } = useLayout();

  return (
    <Pressable onPress={onPress} style={[styles.banner, row]}>
      <View style={styles.bannerIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.bannerText, { textAlign, writingDirection }]}>{text}</Text>
      <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
  },
});
