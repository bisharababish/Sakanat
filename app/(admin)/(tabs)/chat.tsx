import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import {
  conversationIdsMatchingMessage,
  conversationParties,
  deleteConversation,
  loadAllConversations,
  personName,
} from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { colors } from '@/src/theme/colors';
import type { Conversation } from '@/src/types/database';

const PAGE_SIZE = 3;

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
  const { rtlText, alignStart } = useLayout();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
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
    setPage(0);
  }, [query]);

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

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : current * PAGE_SIZE + 1;
  const to = current * PAGE_SIZE + visible.length;

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
      <Text style={[styles.title, rtlText]}>{t('admin.inboxTitle')}</Text>
      <Text style={[styles.hint, rtlText]}>{t('admin.inboxHint')}</Text>
      <Input
        label={t('common.search')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('admin.searchChats')}
        autoCorrect={false}
      />
      {items == null ? null : filtered.length === 0 ? (
        <EmptyState title={query.trim() ? t('admin.noChatsMatch') : t('chat.emptyAdmin')} />
      ) : null}
      {visible.map((item) => {
        const { student, owner } = conversationParties(item);
        const studentLabel = personName(student) || t('roles.student');
        const ownerLabel = personName(owner) || t('roles.owner');
        const listing = item.apartments ? localizedTitle(item.apartments, i18n.language) : '';
        return (
          <Card key={item.id}>
            <Text style={[styles.name, rtlText]}>
              {studentLabel} · {ownerLabel}
            </Text>
            {listing ? <Text style={[styles.listing, rtlText]}>{listing}</Text> : null}
            <Text style={[styles.meta, rtlText]} numberOfLines={2}>
              {item.last_message || '—'}
            </Text>
            <View style={[styles.row, { justifyContent: alignStart }]}>
              <View style={styles.flex}>
                <Button title={t('admin.openChat')} variant="secondary" onPress={() => open(item.id)} />
              </View>
              <View style={styles.flex}>
                <Button title={t('admin.deleteConversation')} variant="danger" onPress={() => remove(item.id)} />
              </View>
            </View>
          </Card>
        );
      })}
      {filtered.length > PAGE_SIZE ? (
        <View style={[styles.row, { justifyContent: alignStart }]}>
          <View style={styles.flex}>
            <Button
              title={t('common.previous')}
              variant="secondary"
              disabled={current === 0}
              onPress={() => setPage(current - 1)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title={t('common.next')}
              variant="secondary"
              disabled={current >= pages - 1}
              onPress={() => setPage(current + 1)}
            />
          </View>
        </View>
      ) : null}
      {filtered.length > 0 ? (
        <Text style={[styles.meta, rtlText]}>
          {t('admin.inboxPage', { from, to, total: filtered.length })}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  hint: { color: colors.textMuted, fontSize: 14, fontFamily: 'Cairo_400Regular', lineHeight: 22, marginTop: -8 },
  name: { fontSize: 17, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  listing: { color: colors.primary, fontFamily: 'Cairo_600SemiBold' },
  meta: { color: colors.textMuted, fontFamily: 'Cairo_400Regular' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
