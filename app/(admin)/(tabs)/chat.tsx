import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationCard } from '@/components/chat/ConversationCard';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import {
  conversationIdsMatchingMessage,
  conversationParties,
  deleteConversation,
  loadAllConversations,
  personName,
} from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { ADMIN_CHAT_PAGE_SIZE } from '@/src/lib/page';
import { seekerRoleLabel } from '@/src/lib/seeker';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

function haystack(item: Conversation, lang: string) {
  const { student, owner } = conversationParties(item);
  return [
    personName(student),
    personName(owner),
    student?.email,
    owner?.email,
    student?.phone,
    owner?.phone,
    item.apartments?.title_ar,
    item.apartments?.title_en,
    localizedTitle(item.apartments, lang),
    item.last_message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function AdminInbox() {
  const { t, i18n } = useTranslation();
  const { rtlText, row, textAlign, writingDirection } = useLayout();
  const colors = useColors();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState('');
  const [messageHits, setMessageHits] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await loadAllConversations());
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  const filtered = useMemo(() => {
    const list = items ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    const hits = new Set(messageHits);
    return list.filter((item) => haystack(item, i18n.language).includes(needle) || hits.has(item.id));
  }, [items, query, messageHits, i18n.language]);

  const paged = usePaged(filtered, ADMIN_CHAT_PAGE_SIZE, query);

  const remove = (id: string) => {
    alert(t('admin.deleteConversation'), t('admin.confirmDeleteConversation'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteConversation(id);
            await load();
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  const open = (id: string) => {
    router.push({ pathname: '/(admin)/conversation/[id]', params: { id } });
  };

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.chat')}</Text>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.inboxTitle')}</Text>
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.inboxHint')}</Text>
      </View>

      <View
        style={[
          styles.searchBar,
          row,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
        ]}
      >
        <Ionicons name="search" size={20} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('admin.searchChats')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { textAlign, writingDirection, color: colors.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('search.clear')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {items == null ? null : filtered.length === 0 ? (
        <EmptyState title={query.trim() ? t('admin.noChatsMatch') : t('chat.emptyAdmin')} />
      ) : null}

      <View style={styles.list}>
        {paged.slice.map((item) => {
          const { student, owner } = conversationParties(item);
          const studentLabel = personName(student) || seekerRoleLabel(student?.role, t);
          const ownerLabel = personName(owner) || t('roles.owner');
          return (
            <ConversationCard
              key={item.id}
              conversation={item}
              title={`${studentLabel} · ${ownerLabel}`}
              photo={student?.avatar_url}
              onPress={() => open(item.id)}
            >
              <View style={[styles.row, row]}>
                <View style={styles.flex}>
                  <Button title={t('admin.openChat')} variant="secondary" pill onPress={() => open(item.id)} />
                </View>
                <View style={styles.flex}>
                  <Button title={t('admin.deleteConversation')} variant="danger" pill onPress={() => remove(item.id)} />
                </View>
              </View>
            </ConversationCard>
          );
        })}
      </View>

      {filtered.length > 0 ? (
        <Pager
          page={paged.page}
          pages={paged.pages}
          from={paged.from}
          to={paged.to}
          total={paged.total}
          pageSize={paged.pageSize}
          onPage={paged.setPage}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 14, fontFamily: 'Cairo_400Regular', lineHeight: 22 },
  searchBar: {
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
    paddingVertical: 12,
  },
  list: { gap: 10 },
  meta: { fontFamily: 'Cairo_400Regular' },
  row: { gap: 8 },
  flex: { flex: 1 },
});
