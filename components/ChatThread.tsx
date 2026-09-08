import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { usePullRefresh } from '@/src/hooks/usePullRefresh';
import { useAuth } from '@/src/lib/auth';
import { MESSAGE_MAX } from '@/src/lib/limits';
import { alert } from '@/src/lib/notice';
import {
  loadConversation,
  markConversationDelivered,
  markConversationRead,
  messageReceipt,
  deleteMessage,
  sendMessage,
  type MessageReceipt,
} from '@/src/lib/chat';
import { enqueueChatOutbox, flushChatOutbox } from '@/src/lib/chatOutbox';
import { pickChatPhoto } from '@/src/lib/pickImage';
import { uploadChatPhoto } from '@/src/lib/upload';
import { logAdminAction } from '@/src/lib/audit';
import { supabase, uniqueChannel } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation, Message } from '@/src/types/database';

function dayKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string, lang: string, today: string, yesterday: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((startToday - start) / 86400000);
  if (diff === 0) return today;
  if (diff === 1) return yesterday;
  return date.toLocaleDateString(lang.startsWith('ar') ? 'ar' : 'en', { day: 'numeric', month: 'short' });
}

function timeLabel(iso: string, lang: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(lang.startsWith('ar') ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' });
}

function ReceiptTick({
  status,
  onMine,
}: {
  status: MessageReceipt;
  onMine: boolean;
}) {
  const colors = useColors();
  const muted = onMine ? 'rgba(255,255,255,0.72)' : colors.textMuted;
  const read = onMine ? colors.accent : colors.primary;
  if (status === 'pending') return <Ionicons name="time-outline" size={13} color={muted} />;
  if (status === 'sent') return <Ionicons name="checkmark" size={13} color={muted} />;
  if (status === 'delivered') return <Ionicons name="checkmark-done" size={13} color={muted} />;
  return <Ionicons name="checkmark-done" size={13} color={read} />;
}

type ThreadItem = Message & { showDay: boolean; grouped: boolean; lastInGroup: boolean };

export function ChatThread({
  conversationId,
  readOnly = false,
  studentId,
  ownerId,
  studentName,
  ownerName,
}: {
  conversationId: string;
  readOnly?: boolean;
  studentId?: string;
  ownerId?: string;
  studentName?: string;
  ownerName?: string;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { textAlign, writingDirection, isRtl, row } = useLayout();
  const colors = useColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ThreadItem>>(null);
  const asOwner = profile?.role === 'owner';

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
  }, [conversationId]);

  const { refreshing, refresh } = usePullRefresh(loadMessages);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadMessages();
    });
    return () => sub.remove();
  }, [loadMessages]);

  useEffect(() => {
    let mounted = true;
    void loadConversation(conversationId)
      .then((row) => {
        if (mounted) setConversation(row);
      })
      .catch(() => {
        if (mounted) setConversation(null);
      });
    void loadMessages();

    const channel = uniqueChannel(`thread:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const next = payload.new as Message;
          setMessages((current) => {
            if (current.some((item) => item.id === next.id)) return current;
            const withoutTemp = current.filter(
              (item) =>
                !(
                  item.id.startsWith('temp-') &&
                  item.sender_id === next.sender_id &&
                  (item.body === next.body ||
                    (item.image_url && next.image_url && item.image_url === next.image_url))
                ),
            );
            return [...withoutTemp, next];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
        (payload) => {
          setConversation((current) =>
            current ? { ...current, ...(payload.new as Partial<Conversation>) } : (payload.new as Conversation),
          );
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, loadMessages]);

  const items: ThreadItem[] = useMemo(() => {
    return messages.map((item, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const sameDayPrev = prev && dayKey(prev.created_at) === dayKey(item.created_at);
      const sameDayNext = next && dayKey(next.created_at) === dayKey(item.created_at);
      const grouped = Boolean(prev && prev.sender_id === item.sender_id && sameDayPrev);
      const lastInGroup = !(next && next.sender_id === item.sender_id && sameDayNext);
      return {
        ...item,
        showDay: index === 0 || dayKey(item.created_at) !== dayKey(messages[index - 1].created_at),
        grouped,
        lastInGroup,
      };
    });
  }, [messages]);

  useEffect(() => {
    if (readOnly) return;
    void flushChatOutbox().then((result) => {
      if (result.sent > 0) void loadMessages();
    });
  }, [loadMessages, readOnly]);

  useEffect(() => {
    if (!profile?.id || readOnly) return;
    void markConversationDelivered(conversationId, asOwner);
    void markConversationRead(conversationId, profile.id, asOwner);
  }, [asOwner, conversationId, profile?.id, readOnly, messages.length]);

  const deliver = async (body: string, imageUri?: string | null) => {
    if (readOnly || !profile || sending) return;
    const text = body.trim().slice(0, MESSAGE_MAX);
    if (!text && !imageUri) return;
    const tempId = `temp-${Date.now()}`;
    const temp: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: profile.id,
      body: text || t('chat.photoMessage'),
      image_url: imageUri || null,
      created_at: new Date().toISOString(),
    };
    if (!imageUri) setDraft('');
    setMessages((current) => [...current, temp]);
    setSending(true);
    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        imageUrl = await uploadChatPhoto(profile.id, conversationId, imageUri);
      }
      await sendMessage(conversationId, profile.id, text, imageUrl);
      void loadMessages();
    } catch (err) {
      await enqueueChatOutbox({
        id: tempId,
        conversationId,
        senderId: profile.id,
        body: text,
        imageUri: imageUri || null,
        createdAt: temp.created_at,
      });
      alert(
        t('common.error'),
        err instanceof Error && err.message ? err.message : t('chat.sendQueued'),
      );
    } finally {
      setSending(false);
    }
  };

  const onSend = async () => {
    if (!draft.trim()) return;
    await deliver(draft);
  };

  const onAttach = async () => {
    const uri = await pickChatPhoto();
    if (!uri) return;
    await deliver(draft, uri);
    setDraft('');
  };

  const canSend = Boolean(draft.trim()) && !sending;

  const removeMessage = (item: Message) => {
    if (!readOnly || item.id.startsWith('temp-')) return;
    alert(t('admin.deleteMessage'), t('admin.confirmDeleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(item.id);
            setMessages((current) => current.filter((row) => row.id !== item.id));
            void logAdminAction('message.delete', { targetId: item.id });
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (!refreshing) listRef.current?.scrollToEnd({ animated: true });
        }}
        bounces
        alwaysBounceVertical
        overScrollMode="always"
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.empty, { textAlign, color: colors.textMuted }]}>
              {readOnly ? t('chat.emptyThreadAdmin') : t('chat.emptyThread')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const fromStudent = Boolean(studentId && item.sender_id === studentId);
          const fromOwner = Boolean(ownerId && item.sender_id === ownerId);
          const mine = readOnly ? fromOwner : item.sender_id === profile?.id;
          const senderLabel = fromStudent ? studentName : fromOwner ? ownerName : undefined;
          const pending = item.id.startsWith('temp-');
          const receipt = messageReceipt(item, conversation);
          const showTicks = item.lastInGroup && (readOnly || mine);
          return (
            <View style={{ marginTop: item.showDay ? 4 : item.grouped ? 3 : 10 }}>
              {item.showDay ? (
                <View style={styles.dayWrap}>
                  <Text style={[styles.day, { backgroundColor: colors.accentSoft, color: colors.primaryDark }]}>
                    {dayLabel(item.created_at, i18n.language, t('chat.today'), t('chat.yesterday'))}
                  </Text>
                </View>
              ) : null}
              {readOnly && senderLabel && !item.grouped ? (
                <Text
                  style={[
                    styles.sender,
                    { color: colors.textMuted },
                    mine ? styles.senderMine : styles.senderTheirs,
                  ]}
                >
                  {senderLabel}
                </Text>
              ) : null}
              <Pressable
                onLongPress={readOnly ? () => removeMessage(item) : undefined}
                delayLongPress={350}
                style={[
                  styles.bubble,
                  mine
                    ? {
                        alignSelf: 'flex-end',
                        backgroundColor: colors.primary,
                        borderBottomRightRadius: item.lastInGroup ? 6 : 20,
                        opacity: pending ? 0.78 : 1,
                      }
                    : {
                        alignSelf: 'flex-start',
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderBottomLeftRadius: item.lastInGroup ? 6 : 20,
                      },
                ]}
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.bubbleImage}
                    contentFit="cover"
                  />
                ) : null}
                {item.body && !(item.image_url && item.body === t('chat.photoMessage')) ? (
                  <Text
                    style={[
                      styles.body,
                      { writingDirection, color: mine ? colors.white : colors.text },
                    ]}
                  >
                    {item.body}
                  </Text>
                ) : null}
                {item.lastInGroup ? (
                  <View style={[styles.meta, row]}>
                    <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.72)' : colors.textMuted }]}>
                      {timeLabel(item.created_at, i18n.language)}
                    </Text>
                    {showTicks ? <ReceiptTick status={receipt} onMine={mine} /> : null}
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        }}
      />
      {readOnly ? null : (
        <View
          style={[
            styles.composer,
            row,
            {
              paddingBottom: Math.max(insets.bottom, spacing.sm),
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Pressable
            onPress={() => void onAttach()}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t('chat.attachPhoto')}
            style={[styles.attach, { backgroundColor: colors.surfaceMuted }]}
          >
            <Ionicons name="image-outline" size={20} color={colors.primary} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={(value) => setDraft(value.slice(0, MESSAGE_MAX))}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MESSAGE_MAX}
            style={[
              styles.input,
              {
                textAlign,
                writingDirection,
                backgroundColor: colors.surfaceMuted,
                color: colors.text,
              },
            ]}
          />
          <Pressable
            onPress={() => void onSend()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            style={[
              styles.send,
              { backgroundColor: canSend || sending ? colors.primary : colors.surfaceMuted },
            ]}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={canSend ? colors.white : colors.textMuted}
                style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.md, flexGrow: 1, paddingBottom: spacing.lg },
  emptyBox: {
    alignItems: 'center',
    gap: 10,
    marginTop: 48,
    marginHorizontal: spacing.sm,
    padding: spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontFamily: 'Cairo_400Regular', lineHeight: 22 },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  day: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
  },
  bubbleImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
  },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  meta: { alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  time: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  sender: { fontSize: 11, fontFamily: 'Cairo_700Bold', marginBottom: 4, marginHorizontal: 4 },
  senderMine: { alignSelf: 'flex-end' },
  senderTheirs: { alignSelf: 'flex-start' },
  composer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  attach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
