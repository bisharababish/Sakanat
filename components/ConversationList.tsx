import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationCard } from '@/components/chat/ConversationCard';
import { Pager } from '@/components/ui/Pager';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { loadConversations, otherPerson, personName, isConversationUnread, markInboxDelivered } from '@/src/lib/chat';
import { CHAT_PAGE_SIZE } from '@/src/lib/page';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

export function useInbox() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Conversation[] | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const column = profile.role === 'owner' ? 'owner_id' : 'student_id';
    try {
      const rows = await loadConversations(column, profile.id);
      setItems(rows);
      void markInboxDelivered(rows, profile.role === 'owner');
    } catch {
      setItems([]);
    }
  }, [profile]);

  const { refreshing, refresh } = useLiveReload(load, ['conversations', 'messages'], `inbox:${profile?.id ?? ''}`);

  return { items, refreshing, refresh, profile };
}

export function ConversationList({
  roleHref,
  items,
  profileId,
  isOwner,
}: {
  roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]';
  items: Conversation[] | null;
  profileId?: string;
  isOwner?: boolean;
}) {
  if (!items) return null;
  return <ConversationPages items={items} roleHref={roleHref} profileId={profileId} isOwner={isOwner} />;
}

function ConversationPages({
  items,
  roleHref,
  profileId,
  isOwner,
}: {
  items: Conversation[];
  roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]';
  profileId?: string;
  isOwner?: boolean;
}) {
  const { t } = useTranslation();
  const { textAlign, writingDirection } = useLayout();
  const colors = useColors();
  const paged = usePaged(items, CHAT_PAGE_SIZE, String(items.length));

  if (items.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.emptyText, { textAlign, writingDirection, color: colors.textMuted }]}>
          {isOwner ? t('chat.emptyOwner') : t('chat.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {paged.slice.map((item) => {
        const person = otherPerson(item, profileId);
        return (
          <ConversationCard
            key={item.id}
            conversation={item}
            title={personName(person) || t('chat.unknownPerson')}
            photo={person?.avatar_url}
            unread={isConversationUnread(item, profileId)}
            onPress={() => router.push({ pathname: roleHref, params: { id: item.id } })}
          />
        );
      })}
      <Pager
        page={paged.page}
        pages={paged.pages}
        from={paged.from}
        to={paged.to}
        total={paged.total}
        pageSize={paged.pageSize}
        onPage={paged.setPage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: 24,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
});
