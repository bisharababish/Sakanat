import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';
import { radius, spacing } from '@/src/theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ProfileMenuLink = {
  key: string;
  icon: IconName;
  label: string;
  hint?: string;
  dot?: boolean;
  danger?: boolean;
  onPress: () => void;
};

function MenuRow({
  icon,
  label,
  hint,
  dot,
  danger,
  last,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  dot?: boolean;
  danger?: boolean;
  last?: boolean;
  onPress?: () => void;
}) {
  const { row, rtlText, isRtl } = useLayout();
  const colors = useColors();
  const tint = danger ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <View style={[styles.rowInner, row]}>
        <View style={[styles.iconWrap, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.label, rtlText, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
          {hint ? (
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        <View style={styles.trail}>
          {dot ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
          {onPress ? <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ProfileMenu({
  links,
  groups,
}: {
  links?: ProfileMenuLink[];
  groups?: ProfileMenuLink[][];
}) {
  const colors = useColors();
  const blocks = (groups ?? (links ? [links] : [])).filter((group) => group.length > 0);

  return (
    <View style={styles.stack}>
      {blocks.map((group, blockIndex) => (
        <View
          key={group.map((item) => item.key).join('-') || String(blockIndex)}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {group.map((item, index) => (
            <MenuRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              hint={item.hint}
              dot={item.dot}
              danger={item.danger}
              last={index === group.length - 1}
              onPress={item.onPress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pressed: { opacity: 0.88 },
  rowInner: { alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 16, fontFamily: 'Cairo_600SemiBold' },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
