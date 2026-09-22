import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { conversationPreview } from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { listingPlaceLine } from '@/src/lib/listingPlace';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

function formatWhen(iso: string, lang: string, yesterday: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startToday - start) / 86400000);
  const locale = lang.startsWith('ar') ? 'ar' : 'en';
  if (diff === 0) {
    return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  }
  if (diff === 1) return yesterday;
  if (diff < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function ConversationCard({
  conversation,
  title,
  photo,
  unread,
  muted,
  archived,
  hideListing,
  badge,
  onPress,
  onLongPress,
  children,
}: {
  conversation: Conversation;
  title: string;
  photo?: string | null;
  unread?: boolean;
  muted?: boolean;
  archived?: boolean;
  hideListing?: boolean;
  badge?: string;
  onPress: () => void;
  onLongPress?: () => void;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const listing =
    hideListing || !conversation.apartments
      ? ''
      : [localizedTitle(conversation.apartments, i18n.language), listingPlaceLine(conversation.apartments, t)]
          .filter(Boolean)
          .join(' · ');
  const preview = conversationPreview(conversation.last_message) || '—';

  return (
    <View>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={({ pressed }) => [
          styles.row,
          row,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
        ]}
      >
        <View style={styles.avatarWrap}>
          {photo ? (
            <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
          ) : (
            <View style={[styles.photo, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.initials, { color: colors.primary }]}>{initials(title)}</Text>
            </View>
          )}
          {muted ? (
            <View style={[styles.muteBadge, { backgroundColor: colors.warning, borderColor: colors.surface }]}>
              <Ionicons name="notifications-off" size={9} color="#fff" />
            </View>
          ) : unread ? (
            <View style={[styles.unreadRing, { backgroundColor: colors.primary, borderColor: colors.surface }]} />
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={[styles.top, row]}>
            <Text
              style={[
                styles.title,
                { textAlign, writingDirection, color: colors.text },
                unread ? styles.titleUnread : null,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text style={[styles.when, { color: unread ? colors.primary : colors.textMuted }]}>
              {formatWhen(conversation.last_message_at, i18n.language, t('chat.yesterday'))}
            </Text>
          </View>

          {(listing || badge) && !muted ? (
            <Text
              style={[styles.listing, { textAlign, writingDirection, color: badge ? colors.accent : colors.textMuted }]}
              numberOfLines={1}
            >
              {[listing, badge].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          <View style={[styles.bottom, row]}>
            <View style={[styles.previewRow, row]}>
              {archived ? <Ionicons name="archive-outline" size={12} color={colors.textMuted} /> : null}
              <Text
                style={[
                  styles.preview,
                  { textAlign, writingDirection, color: unread ? colors.text : colors.textMuted },
                  unread ? styles.previewUnread : null,
                ]}
                numberOfLines={1}
              >
                {preview}
              </Text>
            </View>
            {muted ? (
              <View style={[styles.mutedChip, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="notifications-off" size={11} color={colors.warning} />
                <Text style={[styles.mutedChipText, { color: colors.warning }]}>{t('chat.mutedLabel')}</Text>
              </View>
            ) : unread ? (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            ) : null}
          </View>
        </View>
      </Pressable>
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 70,
  },
  avatarWrap: { position: 'relative' },
  photo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadRing: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  initials: { fontFamily: 'Cairo_700Bold', fontSize: 16 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  top: { alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: 'Cairo_700Bold', letterSpacing: -0.2 },
  titleUnread: { fontFamily: 'Cairo_800ExtraBold' },
  when: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', flexShrink: 0 },
  listing: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  bottom: { alignItems: 'center', gap: 8, marginTop: 1 },
  previewRow: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  preview: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 17 },
  previewUnread: { fontFamily: 'Cairo_600SemiBold' },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  mutedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  mutedChipText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
  extra: { marginTop: 4, gap: 4 },
});
