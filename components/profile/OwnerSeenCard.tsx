import { type ComponentProps, type ReactNode, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdVerifyBadge } from '@/components/profile/IdVerifyBadge';
import { useLayout } from '@/src/hooks/useLayout';
import type { IdVerifyStatus, UserRole } from '@/src/types/database';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Line = { icon: ComponentProps<typeof Ionicons>['name']; text: string };

type Props = {
  title: string;
  name: string;
  avatarUrl: string | null;
  lines: Line[];
  bio?: string | null;
  verifyStatus?: IdVerifyStatus | null;
  verifyRole?: UserRole | null;
  onViewPhoto?: () => void;
  footer?: ReactNode;
};

function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function OwnerSeenCard({
  title,
  name,
  avatarUrl,
  lines,
  bio,
  verifyStatus,
  verifyRole,
  onViewPhoto,
  footer,
}: Props) {
  const { t } = useTranslation();
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const preview = lines.slice(0, 3);
  const shown = open ? lines : preview;
  const canExpand = lines.length > 3 || Boolean(bio?.trim());

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
        <Pressable
          onPress={avatarUrl && onViewPhoto ? onViewPhoto : undefined}
          disabled={!(avatarUrl && onViewPhoto)}
          accessibilityRole={avatarUrl && onViewPhoto ? 'button' : undefined}
          accessibilityLabel={avatarUrl && onViewPhoto ? t('profile.viewPhoto') : undefined}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} recyclingKey={avatarUrl} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.personCopy}>
          <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <IdVerifyBadge status={verifyStatus} role={verifyRole} compact />
        </View>
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
          {!open && canExpand && lines.length > preview.length ? (
            <Pressable onPress={() => setOpen(true)} style={[styles.chip, row, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.chipText, { color: colors.textMuted }]}>+{lines.length - preview.length}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {open && bio?.trim() ? (
        <Text style={[styles.bio, rtlText, { color: colors.textMuted }]} numberOfLines={4}>
          {bio.trim()}
        </Text>
      ) : null}
      {footer}
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
  personCopy: { flex: 1, minWidth: 0, gap: 4 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  name: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
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
  bio: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
});
