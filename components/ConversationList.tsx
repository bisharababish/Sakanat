import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationCard } from '@/components/chat/ConversationCard';
import { SwipeableConversation } from '@/components/chat/SwipeableConversation';
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
import { dismissConversation, dismissedConversationIds, pinnedListingConversationIds } from '@/src/lib/chatDeleted';
import { CHAT_PAGE_SIZE } from '@/src/lib/page';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

export type InboxFilter = 'inbox' | 'unread' | 'archived';

export function useInbox() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    const column = profile.role === 'owner' ? 'owner_id' : 'student_id';
    try {
      const rows = await loadConversations(column, profile.id);
      setItems(rows);
      setLoadError('');
      void markInboxDelivered(rows, profile.role === 'owner');
    } catch (err) {
      setItems([]);
      setLoadError(err instanceof Error ? err.message : t('common.offlineHint'));
    }
  }, [profile, t]);

  const patch = useCallback((id: string, next: Partial<Conversation>) => {
    setItems((prev) => (prev ? prev.map((row) => (row.id === id ? { ...row, ...next } : row)) : prev));
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['conversations', 'messages'], `inbox:${profile?.id ?? ''}`);

  return { items, loadError, refreshing, refresh, profile, reload: load, patch };
}

export function ConversationList({
  roleHref,
  items,
  loadError,
  profileId,
  isOwner,
  onReload,
  onPatch,
  filter,
  onFilterChange,
  apartmentId,
  pinApartmentId,
  pinApartmentIds,
}: {
  roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]';
  items: Conversation[] | null;
  loadError?: string;
  profileId?: string;
  isOwner?: boolean;
  onReload?: () => void | Promise<void>;
  onPatch?: (id: string, next: Partial<Conversation>) => void;
  filter?: InboxFilter;
  onFilterChange?: (next: InboxFilter) => void;
  apartmentId?: string;
  pinApartmentId?: string;
  pinApartmentIds?: string[];
}) {
  const { t } = useTranslation();
  const colors = useColors();
  if (!items) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (loadError) {
    return (
      <EmptyState
        title={t('common.loadFailed')}
        hint={loadError}
        actionTitle={t('common.retry')}
        onAction={() => void onReload?.()}
      />
    );
  }
  const scoped = apartmentId ? items.filter((item) => item.apartment_id === apartmentId) : items;
  return (
    <ConversationPages
      items={scoped}
      roleHref={roleHref}
      profileId={profileId}
      isOwner={isOwner}
      onReload={onReload}
      onPatch={onPatch}
      filter={filter}
      onFilterChange={onFilterChange}
      pinApartmentId={pinApartmentId}
      pinApartmentIds={pinApartmentIds}
    />
  );
}

function ConversationPages({
  items,
  roleHref,
  profileId,
  isOwner,
  onReload,
  onPatch,
  filter: filterProp,
  onFilterChange,
  pinApartmentId,
  pinApartmentIds,
}: {
  items: Conversation[];
  roleHref: '/(student)/conversation/[id]' | '/(owner)/conversation/[id]';
  profileId?: string;
  isOwner?: boolean;
  onReload?: () => void | Promise<void>;
  onPatch?: (id: string, next: Partial<Conversation>) => void;
  filter?: InboxFilter;
  onFilterChange?: (next: InboxFilter) => void;
  pinApartmentId?: string;
  pinApartmentIds?: string[];
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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profileId) {
      setHiddenListings(new Set());
      setPinnedListings(new Set());
      setDismissed(new Set());
      return;
    }
    let cancelled = false;
    void Promise.all([
      hiddenListingChatKeys(profileId, Boolean(isOwner)),
      pinnedListingConversationIds(),
      dismissedConversationIds(),
    ])
      .then(([hidden, pinned, gone]) => {
        if (!cancelled) {
          setHiddenListings(hidden);
          setPinnedListings(pinned);
          setDismissed(gone);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHiddenListings(new Set());
          setPinnedListings(new Set());
          setDismissed(new Set());
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
      if (dismissed.has(item.id)) return false;
      const archived = isConversationArchived(item, profileId);
      if (filter === 'archived') return archived;
      if (archived) return false;
      if (filter === 'unread') return isConversationUnread(item, profileId);
      return true;
    });
  }, [items, filter, profileId, dismissed]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;
    const hits = new Set(messageHits);
    return scoped.filter(
      (item) => conversationSearchHaystack(item, i18n.language).includes(needle) || hits.has(item.id),
    );
  }, [scoped, query, messageHits, i18n.language]);

  const pinIds = useMemo(() => {
    const ids = new Set(pinApartmentIds ?? []);
    if (pinApartmentId) ids.add(pinApartmentId);
    return ids;
  }, [pinApartmentId, pinApartmentIds]);

  const sorted = useMemo(() => {
    if (pinIds.size === 0) return filtered;
    return [...filtered].sort((a, b) => {
      const aPin = a.apartment_id && pinIds.has(a.apartment_id) ? 0 : 1;
      const bPin = b.apartment_id && pinIds.has(b.apartment_id) ? 0 : 1;
      return aPin - bPin;
    });
  }, [filtered, pinIds]);

  const paged = usePaged(
    sorted,
    CHAT_PAGE_SIZE,
    `${filter}:${query}:${sorted.length}:${[...pinIds].sort().join(',')}`,
  );

  const unreadCount = useMemo(
    () =>
      items.filter(
        (item) =>
          !dismissed.has(item.id) &&
          !isConversationArchived(item, profileId) &&
          isConversationUnread(item, profileId),
      ).length,
    [items, profileId, dismissed],
  );
  const archivedCount = useMemo(
    () => items.filter((item) => !dismissed.has(item.id) && isConversationArchived(item, profileId)).length,
    [items, profileId, dismissed],
  );

  const runMute = (item: Conversation) => {
    const muted = isConversationMuted(item, profileId);
    const next = !muted;
    const patch = isOwner ? { owner_muted: next } : { student_muted: next };
    onPatch?.(item.id, patch);
    alert(t('common.done'), muted ? t('chat.unmutedToast') : t('chat.mutedToast'));
    void (async () => {
      try {
        await setConversationMuted(item.id, Boolean(isOwner), next);
        void onReload?.();
      } catch (err) {
        onPatch?.(item.id, isOwner ? { owner_muted: muted } : { student_muted: muted });
        alert(t('common.error'), err instanceof Error ? err.message : t('chat.inboxActionFailed'));
      }
    })();
  };

  const runArchive = (item: Conversation) => {
    const archived = isConversationArchived(item, profileId);
    const next = !archived;
    const stamp = next ? new Date().toISOString() : null;
    const before = isOwner
      ? { owner_archived_at: item.owner_archived_at ?? null }
      : { student_archived_at: item.student_archived_at ?? null };
    onPatch?.(item.id, isOwner ? { owner_archived_at: stamp } : { student_archived_at: stamp });
    alert(t('common.done'), archived ? t('chat.unarchivedToast') : t('chat.archivedToast'));
    void (async () => {
      try {
        await setConversationArchived(item.id, Boolean(isOwner), next);
        void onReload?.();
      } catch (err) {
        onPatch?.(item.id, before);
        alert(t('common.error'), err instanceof Error ? err.message : t('chat.inboxActionFailed'));
      }
    })();
  };

  const runDelete = (item: Conversation) => {
    alert(t('chat.deleteChat'), t('chat.confirmDeleteChat'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.deleteChat'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await dismissConversation(item.id);
              setDismissed((prev) => new Set([...prev, item.id]));
              void onReload?.();
            } catch (err) {
              alert(t('common.error'), err instanceof Error ? err.message : t('chat.inboxActionFailed'));
            }
          })();
        },
      },
    ]);
  };

  const manage = (item: Conversation) => {
    const muted = isConversationMuted(item, profileId);
    const archived = isConversationArchived(item, profileId);
    alert(t('chat.manageTitle'), personName(otherPerson(item, profileId)) || t('chat.unknownPerson'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: muted ? t('chat.unmute') : t('chat.mute'),
        onPress: () => runMute(item),
      },
      {
        text: archived ? t('chat.unarchive') : t('chat.archive'),
        onPress: () => runArchive(item),
      },
      {
        text: t('chat.deleteChat'),
        style: 'destructive',
        onPress: () => runDelete(item),
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

      {items.length > 0 ? (
        <Text style={[styles.hint, { textAlign, writingDirection, color: colors.textMuted }]}>
          {t('chat.inboxHint')}
        </Text>
      ) : null}

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
        <View style={styles.listBlock}>
          <View
            style={[
              styles.list,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {paged.slice.map((item, index) => {
              const person = otherPerson(item, profileId);
              const muted = isConversationMuted(item, profileId);
              const archived = isConversationArchived(item, profileId);
              return (
                <View key={item.id}>
                  <SwipeableConversation
                    muted={muted}
                    archived={archived}
                    onMute={() => runMute(item)}
                    onArchive={() => runArchive(item)}
                    onDelete={() => runDelete(item)}
                  >
                    <ConversationCard
                      conversation={item}
                      title={personName(person) || t('chat.unknownPerson')}
                      photo={person?.avatar_url}
                      unread={isConversationUnread(item, profileId)}
                      muted={muted}
                      archived={archived}
                      hideListing={
                        hiddenListings.has(conversationListingKey(item)) && !pinnedListings.has(item.id)
                      }
                      badge={
                        item.apartment_id && pinIds.has(item.apartment_id)
                          ? isOwner
                            ? t('owner.staying')
                            : t('chat.stayPin')
                          : undefined
                      }
                      onPress={() => router.push({ pathname: roleHref, params: { id: item.id } })}
                      onLongPress={() => manage(item)}
                    />
                  </SwipeableConversation>
                  {index < paged.slice.length - 1 ? (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
              );
            })}
          </View>
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
  loading: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  listBlock: { gap: spacing.sm },
  list: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 74,
  },
  hint: { fontSize: 11, fontFamily: 'Cairo_400Regular', lineHeight: 15, opacity: 0.85, marginTop: -2 },
  searchBar: {
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular', paddingVertical: 8 },
});
