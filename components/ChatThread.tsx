import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  AppState,
} from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ChatContextCard } from '@/components/chat/ChatContextCard';
import { ChatVoiceBubble } from '@/components/chat/ChatVoiceBubble';
import { Button } from '@/components/ui/Button';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useLayout } from '@/src/hooks/useLayout';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { usePullRefresh } from '@/src/hooks/usePullRefresh';
import { useAuth } from '@/src/lib/auth';
import { MESSAGE_MAX, VOICE_MAX_MS } from '@/src/lib/limits';
import { alert } from '@/src/lib/notice';
import {
  loadConversation,
  markConversationDelivered,
  markConversationRead,
  messageReceipt,
  deleteMessage,
  sendMessage,
  isPhotoPlaceholder,
  isVoicePlaceholder,
  listingContextHidden,
  type MessageReceipt,
} from '@/src/lib/chat';
import { deletedMessageIds } from '@/src/lib/chatDeleted';
import { enqueueChatOutbox, flushChatOutbox, subscribeOutboxCount } from '@/src/lib/chatOutbox';
import { pickChatPhoto, takeChatPhoto } from '@/src/lib/pickImage';
import { chatPhotoUrl, uploadChatAudio, uploadChatPhoto } from '@/src/lib/upload';
import { isSeeker, isSeekerAccountReady, seekerProfileGapTab } from '@/src/lib/studentProfile';
import { logAdminAction } from '@/src/lib/audit';
import { supabase, uniqueChannel } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation, Message } from '@/src/types/database';

function ChatBubbleImage({
  pathOrUrl,
  onOpen,
  onLongPress,
}: {
  pathOrUrl: string;
  onOpen: (uri: string) => void;
  onLongPress?: () => void;
}) {
  const colors = useColors();
  const [uri, setUri] = useState<string | null>(
    pathOrUrl.startsWith('http') || pathOrUrl.startsWith('file:') ? pathOrUrl : null,
  );
  useEffect(() => {
    let alive = true;
    void chatPhotoUrl(pathOrUrl).then((next) => {
      if (alive && next) setUri(next);
    });
    return () => {
      alive = false;
    };
  }, [pathOrUrl]);
  if (!uri) {
    return <View style={[styles.bubbleImage, { backgroundColor: colors.surfaceMuted }]} />;
  }
  return (
    <Pressable
      onPress={() => onOpen(uri)}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      style={styles.bubbleImage}
    >
      <Image source={{ uri }} style={styles.bubbleImageFill} contentFit="cover" pointerEvents="none" />
    </Pressable>
  );
}

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
  const muted = colors.textMuted;
  const read = colors.primary;
  if (status === 'pending') return <Ionicons name="time-outline" size={14} color={muted} />;
  if (status === 'sent') return <Ionicons name="checkmark" size={14} color={muted} />;
  if (status === 'delivered') return <Ionicons name="checkmark-done" size={14} color={muted} />;
  return <Ionicons name="checkmark-done" size={14} color={read} />;
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
  const safe = useModalSafeArea();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [showListing, setShowListing] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [outboxLeft, setOutboxLeft] = useState(0);
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const closePendingPhoto = () => setPendingPhoto(null);
  const pendingPhotoBack = useEdgeBack(Boolean(pendingPhoto), closePendingPhoto);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<FlatList<ThreadItem>>(null);
  const asOwner = profile?.role === 'owner';
  const openListing = () => {
    const listingId = conversation?.apartment_id;
    if (!listingId) return;
    if (readOnly) {
      router.push({ pathname: '/(admin)/apartment/[id]', params: { id: listingId } });
      return;
    }
    if (asOwner) {
      router.push({ pathname: '/(owner)/apartment/[id]', params: { id: listingId } });
      return;
    }
    router.push({ pathname: '/(student)/apartment/[id]', params: { id: listingId } });
  };
  const profileBlocked = Boolean(!readOnly && profile && isSeeker(profile) && !isSeekerAccountReady(profile));
  const goCompleteProfile = () => {
    if (!profile) return;
    router.push({
      pathname: '/(student)/(tabs)/profile',
      params: { tab: seekerProfileGapTab(profile) },
    });
  };
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const recMsRef = useRef(0);
  const finishingVoice = useRef(false);

  useEffect(() => {
    return subscribeOutboxCount((count) => setOutboxLeft(count));
  }, []);

  const loadMessages = useCallback(async () => {
    const [{ data }, gone] = await Promise.all([
      supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      deletedMessageIds(conversationId),
    ]);
    setMessages(((data as Message[]) ?? []).filter((row) => !gone.has(row.id)));
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
        void listingContextHidden(row.apartment_id, row.student_id, row.id).then((hidden) => {
          if (mounted) setShowListing(!hidden);
        });
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
          void deletedMessageIds(conversationId).then((gone) => {
            if (gone.has(next.id)) return;
            setMessages((current) => {
              if (current.some((item) => item.id === next.id)) return current;
              const withoutTemp = current.filter(
                (item) =>
                  !(
                    item.id.startsWith('temp-') &&
                    item.sender_id === next.sender_id &&
                    (item.body === next.body ||
                      (item.image_url && next.image_url && item.image_url === next.image_url) ||
                      (item.audio_url && next.audio_url && item.audio_url === next.audio_url))
                  ),
              );
              return [...withoutTemp, next];
            });
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const gone = (payload.old as { id?: string } | null)?.id;
          if (gone) setMessages((current) => current.filter((item) => item.id !== gone));
          else void loadMessages();
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
    void flushChatOutbox(conversationId).then((result) => {
      if (result.sent > 0) void loadMessages();
    });
  }, [conversationId, loadMessages, readOnly]);

  useEffect(() => {
    if (!profile?.id || readOnly) return;
    void markConversationDelivered(conversationId, asOwner);
    void markConversationRead(conversationId, profile.id, asOwner);
  }, [asOwner, conversationId, profile?.id, readOnly, messages.length]);

  const deliver = async (body: string, imageUri?: string | null, audioUri?: string | null) => {
    if (readOnly || !profile || sending || profileBlocked) return;
    const text = body.trim().slice(0, MESSAGE_MAX);
    if (!text && !imageUri && !audioUri) return;
    const tempId = `temp-${Date.now()}`;
    const placeholder = imageUri ? '__photo__' : audioUri ? '__voice__' : '';
    const temp: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: profile.id,
      body: text || placeholder,
      image_url: imageUri || null,
      audio_url: audioUri || null,
      created_at: new Date().toISOString(),
    };
    if (!imageUri && !audioUri) setDraft('');
    setMessages((current) => [...current, temp]);
    setSending(true);
    try {
      let imageUrl: string | null = null;
      let audioUrl: string | null = null;
      if (imageUri) {
        imageUrl = await uploadChatPhoto(profile.id, conversationId, imageUri);
      }
      if (audioUri) {
        audioUrl = await uploadChatAudio(profile.id, conversationId, audioUri);
      }
      await sendMessage(conversationId, profile.id, text, imageUrl, audioUrl);
      void loadMessages();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const tooLarge = message === t('chat.voiceTooLarge') || message === t('chat.photoTooLarge');
      if (tooLarge) {
        setMessages((current) => current.filter((row) => row.id !== tempId));
        alert(t('common.error'), message);
        return;
      }
      await enqueueChatOutbox({
        id: tempId,
        conversationId,
        senderId: profile.id,
        body: text,
        imageUri: imageUri || null,
        audioUri: audioUri || null,
        createdAt: temp.created_at,
      });
      alert(t('common.error'), message || t('chat.sendQueued'));
    } finally {
      setSending(false);
    }
  };

  const onSend = async () => {
    if (profileBlocked) {
      goCompleteProfile();
      return;
    }
    if (!draft.trim()) return;
    await deliver(draft);
  };

  const queuePickedImage = async (uri: string | null) => {
    if (!uri) return;
    setPendingPhoto(uri);
  };

  const onAttach = async () => {
    if (profileBlocked) {
      goCompleteProfile();
      return;
    }
    await queuePickedImage(await pickChatPhoto());
  };

  const onTakePhoto = async () => {
    if (profileBlocked) {
      goCompleteProfile();
      return;
    }
    await queuePickedImage(await takeChatPhoto());
  };

  const sendPendingPhoto = async () => {
    if (!pendingPhoto || sending) return;
    await deliver(draft, pendingPhoto);
    setDraft('');
    setPendingPhoto(null);
  };

  const canSend = Boolean(draft.trim()) && !sending && !recording && !pendingPhoto && !profileBlocked;

  const startVoice = async () => {
    if (profileBlocked) {
      goCompleteProfile();
      return;
    }
    if (readOnly || sending || recording) return;
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        alert(t('common.error'), t('chat.voicePermission'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recMsRef.current = 0;
      recorder.record();
      setRecording(true);
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('chat.voicePermission'));
    }
  };

  useEffect(() => {
    recMsRef.current = recState.durationMillis ?? 0;
  }, [recState.durationMillis]);

  const finishVoice = async (send: boolean) => {
    if (!recording || finishingVoice.current) return;
    finishingVoice.current = true;
    const ms = recMsRef.current;
    setRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (send && uri && ms >= 800) {
        await deliver('', null, uri);
      } else if (send && ms < 800) {
        alert(t('common.error'), t('chat.voiceTooShort'));
      } else if (send && !uri) {
        alert(t('common.error'), t('chat.mediaFailed'));
      }
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('chat.sendFailed'));
    } finally {
      finishingVoice.current = false;
    }
  };

  useEffect(() => {
    if (recording && recState.isRecording && recState.durationMillis >= VOICE_MAX_MS) {
      void finishVoice(true);
    }
  }, [recording, recState.durationMillis, recState.isRecording]);

  const removeMessage = (item: Message) => {
    if (item.id.startsWith('temp-')) return;
    const mine = item.sender_id === profile?.id;
    if (!readOnly && !mine) return;
    alert(t(readOnly ? 'admin.deleteMessage' : 'chat.deleteMessage'), t(readOnly ? 'admin.confirmDeleteMessage' : 'chat.confirmDeleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(item.id);
            setMessages((current) => current.filter((row) => row.id !== item.id));
            if (readOnly) void logAdminAction('message.delete', { targetId: item.id });
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.surfaceMuted }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {!readOnly && profile && isSeeker(profile) && !isSeekerAccountReady(profile) ? (
        <ProfileBanner
          icon="sparkles"
          text={t('chat.completeToChat')}
          onPress={() =>
            router.push({
              pathname: '/(student)/(tabs)/profile',
              params: { tab: seekerProfileGapTab(profile) },
            })
          }
        />
      ) : null}
      <ChatContextCard
        conversation={conversation}
        asOwner={asOwner || readOnly}
        showListing={showListing}
        onOpenListing={openListing}
      />
      {!readOnly && outboxLeft > 0 ? (
        <Pressable
          onPress={() => {
            void flushChatOutbox(conversationId).then((result) => {
              if (result.sent > 0) void loadMessages();
            });
          }}
          style={[styles.outboxBanner, row, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={colors.warning} />
          <Text style={[styles.outboxText, { color: colors.text }]}>
            {t('chat.outboxPending', { count: outboxLeft })}
          </Text>
          <Text style={[styles.outboxRetry, { color: colors.primary }]}>{t('chat.outboxRetry')}</Text>
        </Pressable>
      ) : null}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="always"
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
          const canRemove = !pending && (readOnly || mine);
          const onRemove = canRemove ? () => removeMessage(item) : undefined;
          return (
            <View style={{ marginTop: item.showDay ? 4 : item.grouped ? 3 : 10 }}>
              {item.showDay ? (
                <View style={styles.dayWrap}>
                  <Text style={[styles.day, { backgroundColor: colors.surface, color: colors.textMuted }]}>
                    {dayLabel(item.created_at, i18n.language, t('chat.today'), t('chat.yesterday'))}
                  </Text>
                </View>
              ) : null}
              {readOnly && senderLabel && !item.grouped ? (
                <Text
                  style={[
                    styles.sender,
                    { color: colors.primary },
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
                        backgroundColor: colors.primarySoft,
                        borderBottomRightRadius: item.lastInGroup ? 4 : 16,
                        opacity: pending ? 0.78 : 1,
                      }
                    : {
                        alignSelf: 'flex-start',
                        backgroundColor: colors.surface,
                        borderBottomLeftRadius: item.lastInGroup ? 4 : 16,
                      },
                ]}
              >
                {item.image_url ? (
                  <ChatBubbleImage
                    pathOrUrl={item.image_url}
                    onOpen={(uri) => setViewer({ photos: [uri], index: 0 })}
                    onLongPress={onRemove}
                  />
                ) : null}
                {item.audio_url ? <ChatVoiceBubble pathOrUrl={item.audio_url} mine={mine} onLongPress={onRemove} /> : null}
                {item.body &&
                !(item.image_url && isPhotoPlaceholder(item.body)) &&
                !(item.audio_url && isVoicePlaceholder(item.body)) ? (
                  <Pressable onLongPress={onRemove} delayLongPress={350}>
                    <Text
                      style={[
                        styles.body,
                        { writingDirection, color: colors.text },
                      ]}
                    >
                      {item.body}
                    </Text>
                  </Pressable>
                ) : null}
                {item.lastInGroup ? (
                  <Pressable
                    onLongPress={onRemove}
                    delayLongPress={350}
                    style={[styles.meta, row]}
                  >
                    <Text style={[styles.time, { color: colors.textMuted }]}>
                      {timeLabel(item.created_at, i18n.language)}
                    </Text>
                    {showTicks ? <ReceiptTick status={receipt} onMine={mine} /> : null}
                  </Pressable>
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
              paddingBottom: Math.max(insets.bottom, 8),
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          <Pressable
            onPress={() => void onAttach()}
            disabled={sending || recording || Boolean(pendingPhoto)}
            accessibilityRole="button"
            accessibilityLabel={t('chat.attachPhoto')}
            style={styles.attach}
          >
            <Ionicons name="add-circle" size={30} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => void onTakePhoto()}
            disabled={sending || recording || Boolean(pendingPhoto)}
            accessibilityRole="button"
            accessibilityLabel={t('chat.takePhoto')}
            style={styles.attachSm}
          >
            <Ionicons name="camera" size={22} color={colors.primary} />
          </Pressable>
          {recording ? (
            <View style={[styles.recordBox, row, { backgroundColor: colors.dangerSoft }]}>
              <Pressable
                onPress={() => void finishVoice(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Ionicons name="close" size={18} color={colors.danger} />
              </Pressable>
              <View style={[styles.recDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.recTime, { color: colors.danger }]}>
                {Math.floor((recState.durationMillis ?? 0) / 1000)}s
              </Text>
            </View>
          ) : (
            <TextInput
              value={draft}
              onChangeText={(value) => setDraft(value.slice(0, MESSAGE_MAX))}
              placeholder={t(profileBlocked ? 'chat.completeToChat' : 'chat.placeholder')}
              placeholderTextColor={colors.textMuted}
              editable={!profileBlocked}
              multiline
              maxLength={MESSAGE_MAX}
              style={[
                styles.input,
                {
                  textAlign,
                  writingDirection,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />
          )}
          {canSend || recording || sending ? (
            <Pressable
              onPress={() => (recording ? void finishVoice(true) : void onSend())}
              disabled={recording ? sending : !canSend}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              {sending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Ionicons
                  name={recording ? 'send' : 'send'}
                  size={18}
                  color={colors.white}
                  style={isRtl ? { transform: [{ scaleX: -1 }] } : undefined}
                />
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void startVoice()}
              disabled={sending || Boolean(pendingPhoto)}
              accessibilityRole="button"
              accessibilityLabel={t('chat.voiceMessage')}
              style={[styles.send, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="mic" size={20} color={colors.white} />
            </Pressable>
          )}
        </View>
      )}
      <Modal
        visible={Boolean(pendingPhoto)}
        transparent
        animationType="fade"
        onRequestClose={closePendingPhoto}
      >
        <View
          {...pendingPhotoBack}
          style={[
            styles.previewOverlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: Math.max(safe.top, spacing.md),
              paddingBottom: Math.max(safe.bottom, spacing.md),
            },
          ]}
        >
          <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.previewTitle, { color: colors.primaryDark, textAlign }]}>
              {t('chat.confirmPhoto')}
            </Text>
            {pendingPhoto ? (
              <Image source={{ uri: pendingPhoto }} style={styles.previewImage} contentFit="contain" />
            ) : null}
            <Text style={[styles.previewHint, { color: colors.textMuted, textAlign }]}>
              {t('chat.confirmPhotoBody')}
            </Text>
            <Button
              title={t('chat.usePhoto')}
              pill
              loading={sending}
              onPress={() => void sendPendingPhoto()}
            />
            <Button
              title={t('common.cancel')}
              variant="ghost"
              pill
              onPress={closePendingPhoto}
            />
          </View>
        </View>
      </Modal>
      <PhotoViewer
        photos={viewer?.photos ?? []}
        index={viewer?.index ?? 0}
        visible={Boolean(viewer)}
        onIndexChange={(index) => setViewer((current) => (current ? { ...current, index } : current))}
        onClose={() => setViewer(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 10, paddingTop: 8, flexGrow: 1, paddingBottom: spacing.lg },
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
  dayWrap: { alignItems: 'center', marginVertical: 12 },
  day: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Cairo_700Bold',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 2,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleImage: {
    width: 220,
    height: 160,
    borderRadius: 10,
    marginBottom: 2,
    overflow: 'hidden',
  },
  bubbleImageFill: { width: '100%', height: '100%' },
  body: { fontSize: 15, lineHeight: 21, fontFamily: 'Cairo_400Regular' },
  meta: { alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: 2 },
  time: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  sender: { fontSize: 11, fontFamily: 'Cairo_700Bold', marginBottom: 2, marginHorizontal: 6 },
  senderMine: { alignSelf: 'flex-end' },
  senderTheirs: { alignSelf: 'flex-start' },
  composer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 6,
    alignItems: 'flex-end',
  },
  attach: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachSm: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBox: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 8,
  },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recTime: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  previewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  previewTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: radius.md,
    backgroundColor: '#111',
  },
  previewHint: { fontSize: 14, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  outboxBanner: {
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  outboxText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  outboxRetry: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
});
