import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

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
  const { rtlText, row } = useLayout();
  const colors = useColors();

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.kicker, rtlText, { color: colors.primary }]}>{title}</Text>
      <View style={[styles.person, row]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
          </View>
        )}
        <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={2}>
          {name}
        </Text>
      </View>
      {lines.length ? (
        <View style={[styles.chips, row]}>
          {lines.map((item) => (
            <View key={`${item.icon}-${item.text}`} style={[styles.chip, row, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={item.icon} size={13} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, padding: spacing.md, gap: 12, borderWidth: 1 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  person: { alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  name: { flex: 1, fontSize: 17, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  chips: { flexWrap: 'wrap', gap: 8 },
  chip: {
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipText: { fontSize: 12, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
});
