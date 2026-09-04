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
      <Text style={[styles.kicker, rtlText, { color: colors.primary }]} numberOfLines={1}>
        {title}
      </Text>
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
      {lines.length ? (
        <View style={[styles.chips, row]}>
          {lines.map((item) => (
            <View key={`${item.icon}-${item.text}`} style={[styles.chip, row, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={item.icon} size={11} color={colors.primary} />
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
  box: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
  },
  kicker: { fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  person: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  name: { flex: 1, fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  chips: { flexWrap: 'wrap', gap: 6 },
  chip: {
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  chipText: { fontSize: 11, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
});
