import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { localizedTitle } from '@/src/lib/format';
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
  onPress,
  children,
}: {
  conversation: Conversation;
  title: string;
  photo?: string | null;
  onPress: () => void;
  children?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const listing = conversation.apartments ? localizedTitle(conversation.apartments, i18n.language) : '';
  const listingPhoto = conversation.apartments?.photos?.[0];

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          row,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
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
            <Text style={[styles.title, { textAlign, writingDirection, color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.when, { color: colors.textMuted }]}>
              {formatWhen(conversation.last_message_at, i18n.language, t('chat.yesterday'))}
            </Text>
          </View>
          {listing ? (
            <Text style={[styles.listing, { textAlign, writingDirection, color: colors.primary }]} numberOfLines={1}>
              {listing}
            </Text>
          ) : null}
          <Text style={[styles.preview, { textAlign, writingDirection, color: colors.textMuted }]} numberOfLines={1}>
            {conversation.last_message || '—'}
          </Text>
        </View>
        {listingPhoto ? (
          <Image
            source={{ uri: listingPhoto }}
            style={[styles.listingPhoto, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
          />
        ) : null}
      </Pressable>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  pressed: { opacity: 0.92 },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontWeight: '800', fontFamily: 'Cairo_700Bold', fontSize: 18 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  top: { alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  when: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  listing: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  preview: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  listingPhoto: { width: 48, height: 48, borderRadius: 14 },
  actions: { marginTop: 8, gap: 8 },
});
