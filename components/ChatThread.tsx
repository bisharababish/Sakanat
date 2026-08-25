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
import { sendMessage } from '@/src/lib/chat';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Message } from '@/src/types/database';

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

export function ChatThread({ conversationId }: { conversationId: string }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { textAlign, writingDirection, isRtl, row } = useLayout();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (mounted) setMessages((data as Message[]) ?? []);
      });

    const channel = supabase
      .channel(`messages:${conversationId}`)
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
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const items = useMemo(() => {
    return messages.map((item, index) => ({
      ...item,
      showDay: index === 0 || dayKey(item.created_at) !== dayKey(messages[index - 1].created_at),
    }));
  }, [messages]);

  const onSend = async () => {
    if (!profile || !draft.trim() || sending) return;
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
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
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.empty, { textAlign }]}>{t('chat.emptyThread')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.sender_id === profile?.id;
          return (
            <View>
              {item.showDay ? (
                <View style={styles.dayWrap}>
                  <Text style={styles.day}>
                    {dayLabel(item.created_at, i18n.language, t('chat.today'), t('chat.yesterday'))}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.body, mine ? styles.mineText : styles.theirsText, { writingDirection }]}>
                  {item.body}
                </Text>
                <Text style={[styles.time, mine ? styles.mineTime : styles.theirsTime]}>
                  {timeLabel(item.created_at, i18n.language)}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <View
        style={[
          styles.composer,
          row,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.input, { textAlign, writingDirection }]}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={sending || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          style={[styles.send, (sending || !draft.trim()) && styles.sendOff]}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color={colors.white}
              style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: 8, flexGrow: 1, paddingBottom: spacing.lg },
  emptyBox: { alignItems: 'center', gap: 10, marginTop: 48, paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { color: colors.textMuted, fontFamily: 'Cairo_400Regular', lineHeight: 22 },
  dayWrap: { alignItems: 'center', marginVertical: 8 },
  day: {
    backgroundColor: colors.accentSoft,
    color: colors.primaryDark,
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
    paddingBottom: 6,
    gap: 4,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  mineText: { color: colors.white },
  theirsText: { color: colors.text },
  time: { fontSize: 11, fontFamily: 'Cairo_400Regular', alignSelf: 'flex-end' },
  mineTime: { color: 'rgba(255,255,255,0.7)' },
  theirsTime: { color: colors.textMuted },
  composer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 0,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4, backgroundColor: colors.primary },
});
