import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdVerifyBadge } from '@/components/profile/IdVerifyBadge';
import { useLayout } from '@/src/hooks/useLayout';
import type { IdVerifyStatus } from '@/src/types/database';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Meta = { icon: ComponentProps<typeof Ionicons>['name']; text: string };

type Props = {
  name: string;
  avatarUrl: string | null;
  uploading?: boolean;
  onChangePhoto: () => void;
  metas?: Meta[];
  chip?: string;
  email?: string | null;
  verifyStatus?: IdVerifyStatus | null;
};

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function ProfileHero({ name, avatarUrl, uploading, onChangePhoto, metas = [], chip, email, verifyStatus }: Props) {
  const { rtlText, isRtl, textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const { t } = useTranslation();
  const shownMetas = metas.filter((item) => item.text).slice(0, 2);

  return (
    <View style={[styles.hero, { backgroundColor: colors.primary }]}>
      <View style={[styles.blob, styles.blobGold]} />
      <View style={[styles.heroBody, row]}>
        <Pressable
          onPress={onChangePhoto}
          accessibilityLabel={avatarUrl ? t('profile.changePhoto') : t('profile.tapPhoto')}
          style={styles.avatarWrap}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
            </View>
          )}
          <View
            style={[
              styles.cameraBadge,
              isRtl ? styles.badgeStart : styles.badgeEnd,
              { backgroundColor: colors.accent, borderColor: colors.primary },
            ]}
          >
            <Ionicons name={uploading ? 'hourglass' : 'camera'} size={11} color={colors.white} />
          </View>
        </Pressable>
        <View style={styles.heroInfo}>
          <View style={[styles.chipRow, row]}>
            {chip ? (
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>{chip}</Text>
              </View>
            ) : null}
            {verifyStatus && verifyStatus !== 'none' ? <IdVerifyBadge status={verifyStatus} compact /> : null}
          </View>
          <Text style={[styles.heroName, rtlText]} numberOfLines={1}>
            {name}
          </Text>
          {email ? (
            <Text style={[styles.heroEmail, { textAlign, writingDirection }]} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          {shownMetas.length ? (
            <Text style={[styles.metaLine, { textAlign, writingDirection }]} numberOfLines={1}>
              {shownMetas.map((item) => item.text).join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  blobGold: {
    backgroundColor: 'rgba(196, 163, 90, 0.2)',
    top: -40,
    end: -24,
  },
  heroBody: {
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  avatarWrap: { width: 64, height: 64 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E4EFE7',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  cameraBadge: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    bottom: -1,
  },
  badgeStart: { start: -2 },
  badgeEnd: { end: -2 },
  heroInfo: { flex: 1, minWidth: 0, gap: 2, alignItems: 'stretch' },
  chipRow: { flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  heroName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
  },
  metaLine: {
    color: 'rgba(244, 233, 207, 0.95)',
    fontSize: 11,
    fontFamily: 'Cairo_600SemiBold',
    marginTop: 2,
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  heroChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
  },
});
