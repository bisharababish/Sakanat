import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { conversationPreview } from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { listingPlaceLine } from '@/src/lib/listingPlace';
import { radius } from '@/src/theme/colors';
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
  onPress: () => void;
  onLongPress?: () => void;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const listing = conversation.apartments
    ? [localizedTitle(conversation.apartments, i18n.language), listingPlaceLine(conversation.apartments, t)]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <View>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        style={({ pressed }) => [
          styles.card,
          row,
          {
            backgroundColor: unread ? colors.primarySoft : colors.surface,
            borderColor: colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.initials, { color: colors.primary }]}>{initials(title)}</Text>
          </View>
        )}
        <View style={styles.body}>
          <View style={[styles.top, row]}>
            <Text
              style={[
                styles.title,
                { textAlign, writingDirection, color: colors.text },
                unread && styles.titleUnread,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {muted ? <Ionicons name="notifications-off-outline" size={12} color={colors.textMuted} /> : null}
            {archived ? <Ionicons name="archive-outline" size={12} color={colors.textMuted} /> : null}
            {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
            <Text style={[styles.when, { color: unread ? colors.primary : colors.textMuted }]}>
              {formatWhen(conversation.last_message_at, i18n.language, t('chat.yesterday'))}
            </Text>
          </View>
          {listing ? (
            <Text style={[styles.listing, { textAlign, writingDirection, color: colors.primary }]} numberOfLines={1}>
              {listing}
            </Text>
          ) : null}
          <Text
            style={[
              styles.preview,
              { textAlign, writingDirection, color: unread ? colors.text : colors.textMuted },
              unread && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {conversationPreview(conversation.last_message) || '—'}
          </Text>
        </View>
      </Pressable>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
  },
  pressed: { opacity: 0.92 },
  photo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontWeight: '800', fontFamily: 'Cairo_700Bold', fontSize: 12 },
  body: { flex: 1, minWidth: 0, gap: 0 },
  top: { alignItems: 'center', gap: 4 },
  title: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  titleUnread: { fontWeight: '800' },
  when: { fontSize: 10, fontFamily: 'Cairo_400Regular' },
  listing: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  preview: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  previewUnread: { fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: { marginTop: 4, gap: 4 },
});
