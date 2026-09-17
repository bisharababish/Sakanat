import { type ComponentProps, type ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdVerifyBadge } from '@/components/profile/IdVerifyBadge';
import { useLayout } from '@/src/hooks/useLayout';
import type { IdVerifyStatus, UserRole } from '@/src/types/database';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Meta = { icon: ComponentProps<typeof Ionicons>['name']; text: string };

type Props = {
  name: string;
  avatarUrl: string | null;
  uploading?: boolean;
  onChangePhoto: () => void;
  onViewPhoto?: () => void;
  metas?: Meta[];
  chip?: string;
  email?: string | null;
  verifyStatus?: IdVerifyStatus | null;
  verifyRole?: UserRole | null;
  progressFilled?: number;
  progressTotal?: number;
};

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

function Ring({ percent, children }: { percent: number; children: ReactNode }) {
  const p = Math.max(0, Math.min(100, percent));
  const gold = 'rgba(196, 163, 90, 1)';
  const track = 'rgba(255,255,255,0.22)';
  return (
    <View style={styles.ring}>
      <View
        pointerEvents="none"
        style={[
          styles.ringArc,
          {
            borderColor: track,
            borderTopColor: p >= 8 ? gold : track,
            borderRightColor: p >= 35 ? gold : track,
            borderBottomColor: p >= 65 ? gold : track,
            borderLeftColor: p >= 92 ? gold : track,
          },
        ]}
      />
      {children}
    </View>
  );
}

export function ProfileHero({
  name,
  avatarUrl,
  uploading,
  onChangePhoto,
  onViewPhoto,
  metas = [],
  chip,
  email,
  verifyStatus,
  verifyRole,
  progressFilled,
  progressTotal,
}: Props) {
  const { rtlText, isRtl, textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const { t } = useTranslation();
  const shownMetas = metas.filter((item) => item.text).slice(0, 2);
  const total = progressTotal ?? 0;
  const filled = progressFilled ?? 0;
  const percent = total > 0 ? Math.round((filled / total) * 100) : null;
  const photo = (
    <>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} cachePolicy="none" recyclingKey={avatarUrl} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
        </View>
      )}
      <Pressable
        onPress={onChangePhoto}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('profile.changePhoto')}
        style={[
          styles.cameraBadge,
          isRtl ? styles.badgeStart : styles.badgeEnd,
          { backgroundColor: colors.accent, borderColor: colors.primary },
        ]}
      >
        <Ionicons name={uploading ? 'hourglass' : 'camera'} size={11} color={colors.white} />
      </Pressable>
    </>
  );

  return (
    <View style={[styles.hero, { backgroundColor: colors.primary }]}>
      <View style={[styles.blob, styles.blobGold]} />
      <View style={[styles.heroBody, row]}>
        <Pressable
          onPress={avatarUrl && onViewPhoto ? onViewPhoto : onChangePhoto}
          accessibilityRole="button"
          accessibilityLabel={
            avatarUrl
              ? onViewPhoto
                ? t('profile.viewPhoto')
                : t('profile.changePhoto')
              : t('profile.tapPhoto')
          }
          style={percent != null ? undefined : styles.avatarWrap}
        >
          {percent != null ? <Ring percent={percent}>{photo}</Ring> : <View style={styles.avatarWrap}>{photo}</View>}
        </Pressable>
        <View style={styles.heroInfo}>
          <View style={[styles.chipRow, row]}>
            {chip ? (
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>{chip}</Text>
              </View>
            ) : null}
            {verifyStatus && verifyStatus !== 'none' ? (
              <IdVerifyBadge status={verifyStatus} compact role={verifyRole} />
            ) : null}
            {percent != null ? <Text style={styles.pct}>{percent}%</Text> : null}
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
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
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
  ring: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringArc: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 32,
    borderWidth: 3,
  },
  avatarWrap: { width: 54, height: 54 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E4EFE7',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 17, fontFamily: 'Cairo_800ExtraBold' },
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
    fontSize: 16,
    fontFamily: 'Cairo_800ExtraBold',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
  },
  metaLine: {
    color: 'rgba(244, 233, 207, 0.95)',
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    marginTop: 2,
  },
  pct: {
    color: 'rgba(244, 233, 207, 0.95)',
    fontSize: 11,
    fontFamily: 'Cairo_600SemiBold',
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
    fontFamily: 'Cairo_600SemiBold',
  },
});
