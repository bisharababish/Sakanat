import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChatPeerSheet } from '@/components/chat/ChatPeerSheet';
import { BackButton } from '@/components/ui/BackButton';
import { MenuButton } from '@/components/menu/MenuButton';
import { NoteModal } from '@/components/ui/NoteModal';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import {
  conversationParties,
  isConversationMuted,
  loadConversation,
  otherPerson,
  personName,
  setConversationMuted,
} from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { submitAppReport } from '@/src/lib/reports';
import { seekerRoleLabel } from '@/src/lib/seeker';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation } from '@/src/types/database';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function ChatHeader({
  conversationId,
  admin = false,
  onDelete,
}: {
  conversationId: string;
  admin?: boolean;
  onDelete?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const { profile } = useAuth();
  const colors = useColors();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBody, setReportBody] = useState('');
  const [reporting, setReporting] = useState(false);
  const [peerOpen, setPeerOpen] = useState(false);

  const reload = useCallback(() => {
    void loadConversation(conversationId)
      .then(setConversation)
      .catch(() => setConversation(null));
  }, [conversationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const { student, owner } = conversationParties(conversation);
  const person = admin ? student : otherPerson(conversation, profile?.id);
  const name = admin
    ? [personName(student) || seekerRoleLabel(student?.role, t), personName(owner) || t('roles.owner')].join(' · ')
    : personName(person) || t('chat.unknownPerson');
  const listing = conversation?.apartments ? localizedTitle(conversation.apartments, i18n.language) : '';
  const photo = person?.avatar_url;
  const listingPhoto = conversation?.apartments?.photos?.[0];
  const asOwner = profile?.role === 'owner';
  const muted = conversation && profile ? isConversationMuted(conversation, profile.id) : false;

  const openListing = () => {
    if (!conversation?.apartment_id || admin) return;
    if (asOwner) {
      router.push({ pathname: '/(owner)/apartment/[id]', params: { id: conversation.apartment_id } });
      return;
    }
    router.push({
      pathname: '/(student)/apartment/[id]',
      params: { id: conversation.apartment_id },
    });
  };

  const toggleMute = () => {
    if (!conversation || admin) return;
    void (async () => {
      try {
        await setConversationMuted(conversation.id, asOwner, !muted);
        reload();
      } catch (err) {
        alert(t('common.error'), err instanceof Error ? err.message : t('chat.inboxActionFailed'));
      }
    })();
  };

  const blockOther = () => {
    if (!conversation || admin || !profile || !person?.id) return;
    alert(t('profile.blockTitle'), t('profile.blockBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.block'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const { blockUser } = await import('@/src/lib/blocks');
              await blockUser(profile.id, person.id);
              alert(t('common.done'), t('chat.blockLeft'), [
                {
                  text: t('common.done'),
                  onPress: () => {
                    if (router.canGoBack()) router.back();
                  },
                },
              ]);
            } catch (err) {
              alert(t('common.error'), err instanceof Error ? err.message : '');
            }
          })();
        },
      },
    ]);
  };

  const sendReport = async () => {
    if (!profile || !person?.id || !conversation) return;
    const body = reportBody.trim();
    if (body.length < 12) {
      alert(t('common.error'), t('profile.reportBodyShort'));
      return;
    }
    setReporting(true);
    try {
      await submitAppReport(profile.id, {
        kind: 'safety',
        subject: t('menu.reportSafetySubject'),
        body: `${t('chat.reportPrefill', { name, listing: listing || '—' })}\n\n${body}`,
        targetUserId: person.id,
        targetApartmentId: conversation.apartment_id ?? null,
      });
      setReportOpen(false);
      setReportBody('');
      alert(t('common.done'), t('profile.reportSent'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.reportFailed'));
    } finally {
      setReporting(false);
    }
  };

  return (
    <>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <BackButton compact />
        <Pressable
          onPress={() => {
            if (!admin && person?.id) setPeerOpen(true);
          }}
          disabled={admin || !person?.id}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('chat.peerProfile')}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.initials, { color: colors.primary }]}>{initials(name)}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.meta}>
          <Pressable
            onPress={() => {
              if (!admin && person?.id) setPeerOpen(true);
            }}
            disabled={admin || !person?.id}
            accessibilityRole="button"
            accessibilityLabel={t('chat.peerProfile')}
          >
            <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
          {listing ? (
            <Pressable onPress={openListing} disabled={admin || !conversation?.apartment_id}>
              <Text style={[styles.sub, rtlText, { color: colors.primary }]} numberOfLines={1}>
                {listing}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {listingPhoto ? (
          <Pressable onPress={openListing} disabled={admin || !conversation?.apartment_id}>
            <Image
              source={{ uri: listingPhoto }}
              style={[styles.listingPhoto, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
            />
          </Pressable>
        ) : null}
        {!admin ? (
          <Pressable
            onPress={toggleMute}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={muted ? t('chat.unmute') : t('chat.mute')}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={muted ? 'notifications-off' : 'notifications-outline'}
              size={20}
              color={muted ? colors.warning : colors.textMuted}
            />
          </Pressable>
        ) : null}
        {!admin && person?.id ? (
          <Pressable
            onPress={() => setReportOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('chat.reportUser')}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="flag-outline" size={20} color={colors.warning} />
          </Pressable>
        ) : null}
        {!admin && person?.id ? (
          <Pressable
            onPress={blockOther}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('profile.block')}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="hand-left-outline" size={20} color={colors.danger} />
          </Pressable>
        ) : null}
        <MenuButton />
        {onDelete ? (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('admin.deleteConversation')}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>

      <NoteModal
        visible={reportOpen}
        title={t('chat.reportUser')}
        label={t('profile.reportDetails')}
        hint={t('chat.reportHint', { name })}
        value={reportBody}
        confirmTitle={t('menu.report')}
        loading={reporting}
        onChange={setReportBody}
        onConfirm={() => void sendReport()}
        onClose={() => {
          if (reporting) return;
          setReportOpen(false);
          setReportBody('');
        }}
      />
      <ChatPeerSheet
        visible={peerOpen}
        userId={person?.id}
        viewerId={profile?.id}
        seed={
          person?.id
            ? {
                id: person.id,
                full_name: person.full_name,
                avatar_url: person.avatar_url,
                role: person.role,
              }
            : null
        }
        onClose={() => setPeerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    direction: 'ltr',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '800', fontFamily: 'Cairo_700Bold', fontSize: 12 },
  meta: { flex: 1, gap: 0, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  listingPhoto: { width: 32, height: 32, borderRadius: 10 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
