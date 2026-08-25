import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/ui/BackButton';
import { MenuButton } from '@/components/menu/MenuButton';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { loadConversation, otherPerson, personName } from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function ChatHeader({ conversationId }: { conversationId: string }) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const { profile } = useAuth();
  const colors = useColors();
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    void loadConversation(conversationId)
      .then(setConversation)
      .catch(() => setConversation(null));
  }, [conversationId]);

  const person = otherPerson(conversation, profile?.id);
  const name = personName(person) || t('chat.unknownPerson');
  const listing = conversation?.apartments ? localizedTitle(conversation.apartments, i18n.language) : '';
  const photo = person?.avatar_url;

  return (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <BackButton compact />
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
        </View>
      )}
      <View style={styles.meta}>
        <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        {listing ? (
          <Text style={[styles.sub, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
            {listing}
          </Text>
        ) : null}
      </View>
      <MenuButton />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    direction: 'ltr',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '800', fontFamily: 'Cairo_700Bold', fontSize: 14 },
  meta: { flex: 1, gap: 1 },
  name: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
});
