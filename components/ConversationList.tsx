import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { loadConversations, otherPerson, personName } from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { colors, radius, spacing } from '@/src/theme/colors';
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

export function ConversationList({
  roleHref,
}: {
  roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]';
}) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, isRtl } = useLayout();
  const { profile } = useAuth();
  const [items, setItems] = useState<Conversation[] | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const column = profile.role === 'owner' ? 'owner_id' : 'student_id';
    try {
      setItems(await loadConversations(column, profile.id));
    } catch {
      setItems([]);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!items) return null;

  if (items.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <View style={styles.emptyIcon}>
          <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.emptyText, { textAlign, writingDirection }]}>
          {profile?.role === 'owner' ? t('chat.emptyOwner') : t('chat.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const person = otherPerson(item, profile?.id);
        const name = personName(person) || t('chat.unknownPerson');
        const photo = person?.avatar_url;
        const listing = item.apartments ? localizedTitle(item.apartments, i18n.language) : '';
        return (
          <Pressable
            key={item.id}
            onPress={() => router.push({ pathname: roleHref, params: { id: item.id } })}
            style={({ pressed }) => [
              styles.card,
              { flexDirection: isRtl ? 'row-reverse' : 'row' },
              pressed && styles.pressed,
            ]}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <Text style={styles.initials}>{initials(name)}</Text>
              </View>
            )}
            <View style={styles.body}>
              <View style={[styles.top, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.title, { textAlign, writingDirection }]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.when}>
                  {formatWhen(item.last_message_at, i18n.language, t('chat.yesterday'))}
                </Text>
              </View>
              {listing ? (
                <Text style={[styles.listing, { textAlign, writingDirection }]} numberOfLines={1}>
                  {listing}
                </Text>
              ) : null}
              <Text style={[styles.preview, { textAlign, writingDirection }]} numberOfLines={1}>
                {item.last_message || '—'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  card: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.92 },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallback: { backgroundColor: colors.primarySoft },
  initials: { color: colors.primary, fontWeight: '800', fontFamily: 'Cairo_700Bold', fontSize: 18 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  top: { alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  when: { color: colors.textMuted, fontSize: 12, fontFamily: 'Cairo_400Regular' },
  listing: { color: colors.primary, fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  preview: { color: colors.textMuted, fontSize: 14, fontFamily: 'Cairo_400Regular' },
  emptyBox: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
});
