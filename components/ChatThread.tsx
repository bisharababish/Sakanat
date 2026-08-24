import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { sendMessage } from '@/src/lib/chat';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Message } from '@/src/types/database';

export function ChatThread({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { textAlign, writingDirection, isRtl } = useLayout();
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
          setMessages((current) => {
            const next = payload.new as Message;
            if (current.some((item) => item.id === next.id)) return current;
            return [...current, next];
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const onSend = async () => {
    if (!profile || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(conversationId, profile.id, draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={[styles.empty, { textAlign }]}>{t('chat.empty')}</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id === profile?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.body, mine ? styles.mineText : styles.theirsText, { writingDirection }]}>
                {item.body}
              </Text>
            </View>
          );
        }}
      />
      <View style={[styles.composer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
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
          style={[styles.send, (sending || !draft.trim()) && styles.sendOff]}>
          <Text style={styles.sendLabel}>{t('chat.send')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: { color: colors.textMuted, marginTop: spacing.lg },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, padding: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  body: { fontSize: 15, lineHeight: 22 },
  mineText: { color: colors.white },
  theirsText: { color: colors.text },
  composer: {
    padding: spacing.md,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
  },
  send: {
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.45 },
  sendLabel: { color: colors.white, fontWeight: '800' },
});
