import { type ComponentProps, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Line = { icon: ComponentProps<typeof Ionicons>['name']; text: string };

type Props = {
  title: string;
  name: string;
  avatarUrl: string | null;
  lines: Line[];
};

function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function OwnerSeenCard({ title, name, avatarUrl, lines }: Props) {
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const preview = lines.slice(0, 3);
  const shown = open ? lines : preview;
  const canExpand = lines.length > 3;

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={() => canExpand && setOpen((value) => !value)} style={[styles.head, row]}>
        <Text style={[styles.kicker, rtlText, { color: colors.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {canExpand ? (
          <Ionicons
            name={open ? 'chevron-up' : isRtl ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={colors.textMuted}
          />
        ) : null}
      </Pressable>
      <View style={[styles.person, row]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
          </View>
        )}
        <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {shown.length ? (
        <View style={[styles.chips, row]}>
          {shown.map((item) => (
            <View key={`${item.icon}-${item.text}`} style={[styles.chip, row, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={item.icon} size={11} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ))}
          {!open && canExpand ? (
            <Pressable onPress={() => setOpen(true)} style={[styles.chip, row, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.chipText, { color: colors.textMuted }]}>+{lines.length - preview.length}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
  },
  head: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kicker: { flex: 1, fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  person: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  name: { flex: 1, fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  chips: { flexWrap: 'wrap', gap: 4 },
  chip: {
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  chipText: { fontSize: 10, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
});
