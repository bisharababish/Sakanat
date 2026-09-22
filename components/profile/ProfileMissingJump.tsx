import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export type MissingJumpItem = { id: string; label: string };

/** Tap cycles through missing fields and jumps to each one. */
export function ProfileMissingJump({
  items,
  onJump,
}: {
  items: MissingJumpItem[];
  onJump: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    setCursor(0);
  }, [items.map((item) => item.id).join('|')]);

  if (items.length === 0) return null;

  const index = cursor % items.length;
  const current = items[index] ?? items[0];
  const list = items.map((item) => item.label).join(' · ');

  return (
    <Pressable
      onPress={() => {
        onJump(current.id);
        setCursor((prev) => (prev + 1) % items.length);
      }}
      style={({ pressed }) => [
        styles.wrap,
        row,
        {
          backgroundColor: colors.warningSoft,
          borderColor: colors.warning,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${t('profile.missingJumpTitle')}: ${list}`}
    >
      <View style={[styles.icon, { backgroundColor: colors.warning }]}>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { textAlign, writingDirection, color: colors.warning }]}>
          {t('profile.missingJumpTitle')}
          {items.length > 1 ? ` · ${index + 1}/${items.length}` : ''}
        </Text>
        <Text style={[styles.list, { textAlign, writingDirection, color: colors.text }]} numberOfLines={3}>
          {list}
        </Text>
        <Text style={[styles.hint, { textAlign, writingDirection, color: colors.textMuted }]}>
          {t('profile.missingJumpHint', { field: current.label })}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 13, fontFamily: 'Cairo_800ExtraBold' },
  list: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', lineHeight: 20 },
  hint: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginTop: 2 },
});
