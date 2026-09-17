import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationCard } from '@/components/chat/ConversationCard';
import { EmptyState } from '@/components/EmptyState';
import { FilterPills } from '@/components/ui/FilterPills';
import { Pager } from '@/components/ui/Pager';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import {
  conversationIdsMatchingMessage,
  conversationSearchHaystack,
  conversationListingKey,
  isConversationArchived,
  isConversationMuted,
  isConversationUnread,
  loadConversations,
  hiddenListingChatKeys,
  markInboxDelivered,
  otherPerson,
  personName,
  setConversationArchived,
  setConversationMuted,
} from '@/src/lib/chat';
import { alert } from '@/src/lib/notice';
import { pinnedListingConversationIds } from '@/src/lib/chatDeleted';
import { CHAT_PAGE_SIZE } from '@/src/lib/page';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

export type InboxFilter = 'inbox' | 'unread' | 'archived';

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

  return { items, refreshing, refresh, profile, reload: load };
}

export function ConversationList({
  roleHref,
  items,
  profileId,
  isOwner,
  onReload,
  filter,
  onFilterChange,
  apartmentId,
  pinApartmentId,
}: {
  roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]';
  items: Conversation[] | null;
  profileId?: string;
  isOwner?: boolean;
  onReload?: () => void | Promise<void>;
  filter?: InboxFilter;
  onFilterChange?: (next: InboxFilter) => void;
  apartmentId?: string;
  pinApartmentId?: string;
}) {
  if (!items) return null;
  const scoped = apartmentId ? items.filter((item) => item.apartment_id === apartmentId) : items;
  return (
    <ConversationPages
      items={scoped}
      roleHref={roleHref}
      profileId={profileId}
      isOwner={isOwner}
      onReload={onReload}
      filter={filter}
      onFilterChange={onFilterChange}
      pinApartmentId={pinApartmentId}
    />
  );
}

function ConversationPages({
  items,
  roleHref,
  profileId,
  isOwner,
  onReload,
  filter: filterProp,
  onFilterChange,
  pinApartmentId,
}: {
  items: Conversation[];
  roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]';
  profileId?: string;
  isOwner?: boolean;
  onReload?: () => void | Promise<void>;
  filter?: InboxFilter;
  onFilterChange?: (next: InboxFilter) => void;
  pinApartmentId?: string;
}) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [internalFilter, setInternalFilter] = useState<InboxFilter>('inbox');
  const filter = filterProp ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;
  const [messageHits, setMessageHits] = useState<string[]>([]);
  const [hiddenListings, setHiddenListings] = useState<Set<string>>(new Set());
  const [pinnedListings, setPinnedListings] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profileId) {
      setHiddenListings(new Set());
      setPinnedListings(new Set());
      return;
    }
    let cancelled = false;
    void Promise.all([hiddenListingChatKeys(profileId, Boolean(isOwner)), pinnedListingConversationIds()])
      .then(([hidden, pinned]) => {
        if (!cancelled) {
          setHiddenListings(hidden);
          setPinnedListings(pinned);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHiddenListings(new Set());
          setPinnedListings(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, isOwner, items]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setMessageHits([]);
      return;
    }
    let cancelled = false;
    void conversationIdsMatchingMessage(needle)
      .then((ids) => {
        if (!cancelled) setMessageHits(ids);
      })
      .catch(() => {
        if (!cancelled) setMessageHits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const scoped = useMemo(() => {
    return items.filter((item) => {
      const archived = isConversationArchived(item, profileId);
      if (filter === 'archived') return archived;
      if (archived) return false;
      if (filter === 'unread') return isConversationUnread(item, profileId);
      return true;
    });
  }, [items, filter, profileId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;
    const hits = new Set(messageHits);
    return scoped.filter(
      (item) => conversationSearchHaystack(item, i18n.language).includes(needle) || hits.has(item.id),
    );
  }, [scoped, query, messageHits, i18n.language]);

  const sorted = useMemo(() => {
    if (!pinApartmentId) return filtered;
    return [...filtered].sort((a, b) => {
      const aPin = a.apartment_id === pinApartmentId ? 0 : 1;
      const bPin = b.apartment_id === pinApartmentId ? 0 : 1;
      return aPin - bPin;
    });
  }, [filtered, pinApartmentId]);

  const paged = usePaged(sorted, CHAT_PAGE_SIZE, `${filter}:${query}:${sorted.length}:${pinApartmentId ?? ''}`);

  const unreadCount = useMemo(
    () => items.filter((item) => !isConversationArchived(item, profileId) && isConversationUnread(item, profileId)).length,
    [items, profileId],
  );
  const archivedCount = useMemo(
    () => items.filter((item) => isConversationArchived(item, profileId)).length,
    [items, profileId],
  );

  const manage = (item: Conversation) => {
    const muted = isConversationMuted(item, profileId);
    const archived = isConversationArchived(item, profileId);
    alert(t('chat.manageTitle'), personName(otherPerson(item, profileId)) || t('chat.unknownPerson'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: muted ? t('chat.unmute') : t('chat.mute'),
        onPress: () => {
          void (async () => {
            try {
              await setConversationMuted(item.id, Boolean(isOwner), !muted);
              await onReload?.();
            } catch (err) {
              alert(t('common.error'), err instanceof Error ? err.message : t('chat.inboxActionFailed'));
            }
          })();
        },
      },
      {
        text: archived ? t('chat.unarchive') : t('chat.archive'),
        onPress: () => {
          void (async () => {
            try {
              await setConversationArchived(item.id, Boolean(isOwner), !archived);
              await onReload?.();
            } catch (err) {
              alert(t('common.error'), err instanceof Error ? err.message : t('chat.inboxActionFailed'));
            }
          })();
        },
      },
    ]);
  };

  const emptyBrowse = () => {
    if (isOwner) {
      router.push('/(owner)/(tabs)/listings');
      return;
    }
    router.push('/(student)/(tabs)/search');
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.searchBar,
          row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('chat.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { textAlign, writingDirection, color: colors.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('search.clear')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FilterPills
        compact
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'inbox', label: t('chat.filterInbox') },
          { value: 'unread', label: t('chat.filterUnread'), count: unreadCount || undefined },
          { value: 'archived', label: t('chat.filterArchived'), count: archivedCount || undefined },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          title={isOwner ? t('chat.emptyOwner') : t('chat.empty')}
          actionTitle={isOwner ? t('chat.emptyOwnerCta') : t('chat.emptyCta')}
          onAction={emptyBrowse}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            filter === 'archived'
              ? t('chat.emptyArchived')
              : filter === 'unread'
                ? t('chat.emptyUnread')
                : t('chat.noMatch')
          }
        />
      ) : (
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
                muted={isConversationMuted(item, profileId)}
                archived={isConversationArchived(item, profileId)}
                hideListing={
                  hiddenListings.has(conversationListingKey(item)) && !pinnedListings.has(item.id)
                }
                badge={item.apartment_id === pinApartmentId ? t('chat.stayPin') : undefined}
                onPress={() => router.push({ pathname: roleHref, params: { id: item.id } })}
                onLongPress={() => manage(item)}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  list: { gap: 6 },
  searchBar: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular', paddingVertical: 6 },
});
