import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import {
  loadConversation,
  markConversationDelivered,
  markConversationRead,
  messageReceipt,
  sendMessage,
  type MessageReceipt,
} from '@/src/lib/chat';
import { supabase } from '@/src/lib/supabase';
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
  const listRef = useRef<FlatList<Message>>(null);
  const asOwner = profile?.role === 'owner';

  useEffect(() => {
    let mounted = true;
    void loadConversation(conversationId)
      .then((row) => {
        if (mounted) setConversation(row);
      })
      .catch(() => {
        if (mounted) setConversation(null);
      });
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (mounted) setMessages((data as Message[]) ?? []);
      });

    const channel = supabase
      .channel(`thread:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const next = payload.new as Message;
          setMessages((current) => {
            if (current.some((item) => item.id === next.id)) return current;
            const withoutTemp = current.filter(
              (item) => !(item.id.startsWith('temp-') && item.body === next.body && item.sender_id === next.sender_id),
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
  }, [conversationId]);

  const items = useMemo(() => {
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
    if (!profile?.id || readOnly) return;
    void markConversationDelivered(conversationId, asOwner);
    void markConversationRead(conversationId, profile.id, asOwner);
  }, [asOwner, conversationId, profile?.id, readOnly, messages.length]);

  const onSend = async () => {
    if (readOnly || !profile || !draft.trim() || sending) return;
    const body = draft.trim();
    const temp: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: profile.id,
      body,
      created_at: new Date().toISOString(),
    };
    setDraft('');
    setMessages((current) => [...current, temp]);
    setSending(true);
    try {
      await sendMessage(conversationId, profile.id, body);
    } catch {
      setMessages((current) => current.filter((item) => item.id !== temp.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(draft.trim()) && !sending;

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
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
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
              <View
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
                <Text
                  style={[
                    styles.body,
                    { writingDirection, color: mine ? colors.white : colors.text },
                  ]}
                >
                  {item.body}
                </Text>
                {item.lastInGroup ? (
                  <View style={[styles.meta, row]}>
                    <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.72)' : colors.textMuted }]}>
                      {timeLabel(item.created_at, i18n.language)}
                    </Text>
                    {showTicks ? <ReceiptTick status={receipt} onMine={mine} /> : null}
                  </View>
                ) : null}
              </View>
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
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
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
