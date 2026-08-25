import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { LogoutButton } from '@/components/ui/LogoutButton';
import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius, spacing } from '@/src/theme/colors';

type Meta = { icon: ComponentProps<typeof Ionicons>['name']; text: string };

type Props = {
  name: string;
  avatarUrl: string | null;
  uploading?: boolean;
  onChangePhoto: () => void;
  metas?: Meta[];
  chip?: string;
  email?: string | null;
};

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function ProfileHero({ name, avatarUrl, uploading, onChangePhoto, metas = [], chip, email }: Props) {
  const { row, rtlText, alignStart, isRtl } = useLayout();

  return (
    <View style={styles.hero}>
      <View style={[styles.blob, styles.blobGold]} />
      <View style={[styles.blob, styles.blobLight]} />
      <View style={[styles.heroTop, row]}>
        <LanguageToggle onDark />
        <LogoutButton />
      </View>
      <View style={[styles.heroBody, row]}>
        <Pressable onPress={onChangePhoto} style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initials}>{initials(name)}</Text>
            </View>
          )}
          <View style={[styles.cameraBadge, isRtl ? styles.badgeStart : styles.badgeEnd]}>
            <Ionicons name={uploading ? 'hourglass' : 'camera'} size={13} color={colors.white} />
          </View>
        </Pressable>
        <View style={styles.heroInfo}>
          <Text style={[styles.heroName, rtlText]} numberOfLines={2}>
            {name}
          </Text>
          {metas.map((item) => (
            <View key={`${item.icon}-${item.text}`} style={[styles.heroMeta, row]}>
              <Ionicons name={item.icon} size={14} color={colors.accent} />
              <Text style={styles.heroMetaText} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ))}
          {chip ? (
            <View style={[styles.heroChip, { alignSelf: alignStart }]}>
              <Text style={styles.heroChipText}>{chip}</Text>
            </View>
          ) : null}
          {email ? (
            <Text style={[styles.heroEmail, rtlText]} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    overflow: 'hidden',
    gap: spacing.md,
    minHeight: 176,
  },
  heroTop: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blob: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  blobGold: {
    backgroundColor: 'rgba(196, 163, 90, 0.22)',
    top: -56,
    end: -28,
  },
  blobLight: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -70,
    start: -40,
  },
  heroBody: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: { width: 88, height: 88 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.primary },
  cameraBadge: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    bottom: 0,
  },
  badgeStart: { start: -2 },
  badgeEnd: { end: -2 },
  heroInfo: { flex: 1, gap: 6 },
  heroName: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
  },
  heroMeta: { alignItems: 'center', gap: 6 },
  heroMetaText: {
    flex: 1,
    color: colors.accentSoft,
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  heroChipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
  },
});
