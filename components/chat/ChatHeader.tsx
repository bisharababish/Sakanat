import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChatPeerSheet } from '@/components/chat/ChatPeerSheet';
import { BackButton, goBack } from '@/components/ui/BackButton';
import { NoteModal } from '@/components/ui/NoteModal';
import { useLayout } from '@/src/hooks/useLayout';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { useAuth } from '@/src/lib/auth';
import {
  conversationParties,
  isConversationMuted,
  loadConversation,
  loadSharedBooking,
  listingContextHidden,
  otherPerson,
  personName,
  setConversationMuted,
} from '@/src/lib/chat';
import { localizedTitle } from '@/src/lib/format';
import { listingPlaceLine } from '@/src/lib/listingPlace';
import { alert } from '@/src/lib/notice';
import { submitAppReport } from '@/src/lib/reports';
import { seekerRoleLabel } from '@/src/lib/seeker';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Conversation, Profile } from '@/src/types/database';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

type PeerPick = {
  id: string;
  full_name?: string | null;
  full_name_en?: string | null;
  avatar_url?: string | null;
  role?: Profile['role'] | null;
};

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
  const { rtlText, row } = useLayout();
  const { profile } = useAuth();
  const colors = useColors();
  const safe = useModalSafeArea();
  useEdgeBack(true, goBack);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBody, setReportBody] = useState('');
  const [reporting, setReporting] = useState(false);
  const [peerOpen, setPeerOpen] = useState(false);
  const [peerPick, setPeerPick] = useState<PeerPick | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [showListing, setShowListing] = useState(true);
  const [adminPickOpen, setAdminPickOpen] = useState(false);
  const closeAdminPick = () => setAdminPickOpen(false);
  const adminPickBack = useEdgeBack(adminPickOpen, closeAdminPick);

  const reload = useCallback(() => {
    void loadConversation(conversationId)
      .then(setConversation)
      .catch(() => setConversation(null));
  }, [conversationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!conversation?.apartment_id || !conversation.student_id) {
      setBookingId(null);
      setShowListing(true);
      return;
    }
    let alive = true;
    void loadSharedBooking({
      apartmentId: conversation.apartment_id,
      studentId: conversation.student_id,
      ownerId: conversation.owner_id,
    }).then((row) => {
      if (alive) setBookingId(row?.id ?? null);
    });
    void listingContextHidden(conversation.apartment_id, conversation.student_id, conversation.id).then((hidden) => {
      if (alive) setShowListing(!hidden);
    });
    return () => {
      alive = false;
    };
  }, [conversation?.id, conversation?.apartment_id, conversation?.student_id, conversation?.owner_id]);

  const { student, owner } = conversationParties(conversation);
  const person = admin ? student : otherPerson(conversation, profile?.id);
  const name = admin
    ? [personName(student) || seekerRoleLabel(student?.role, t), personName(owner) || t('roles.owner')].join(' · ')
    : personName(person) || t('chat.unknownPerson');
  const listing =
    showListing && conversation?.apartments
      ? [localizedTitle(conversation.apartments, i18n.language), listingPlaceLine(conversation.apartments, t)]
          .filter(Boolean)
          .join(' · ')
      : '';
  const photo = admin ? student?.avatar_url || owner?.avatar_url : person?.avatar_url;
  const listingPhoto = showListing ? conversation?.apartments?.photos?.[0] : undefined;
  const asOwner = profile?.role === 'owner';
  const muted = conversation && profile ? isConversationMuted(conversation, profile.id) : false;

  const openPeer = (next: PeerPick | null | undefined) => {
    if (!next?.id) return;
    setPeerPick({
      id: next.id,
      full_name: next.full_name,
      full_name_en: next.full_name_en,
      avatar_url: next.avatar_url,
      role: next.role,
    });
    setAdminPickOpen(false);
    setPeerOpen(true);
  };

  const openHeaderProfile = () => {
    if (admin) {
      if (student?.id && owner?.id) {
        setAdminPickOpen(true);
        return;
      }
      openPeer(student ?? owner);
      return;
    }
    if (person?.id) openPeer(person);
  };

  const openListing = () => {
    if (!conversation?.apartment_id) return;
    if (admin) {
      router.push({ pathname: '/(admin)/apartment/[id]', params: { id: conversation.apartment_id } });
      return;
    }
    if (asOwner) {
      router.push({ pathname: '/(owner)/apartment/[id]', params: { id: conversation.apartment_id } });
      return;
    }
    router.push({
      pathname: '/(student)/apartment/[id]',
      params: { id: conversation.apartment_id },
    });
  };

  const openBooking = () => {
    if (!bookingId) return;
    if (admin) {
      router.push('/(admin)/(tabs)/bookings');
      return;
    }
    if (asOwner) {
      router.push({ pathname: '/(owner)/(tabs)/bookings', params: { focus: bookingId } });
      return;
    }
    router.push({ pathname: '/(student)/(tabs)/bookings', params: { focus: bookingId } });
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
          onPress={openHeaderProfile}
          disabled={admin ? !(student?.id || owner?.id) : !person?.id}
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
            onPress={openHeaderProfile}
            disabled={admin ? !(student?.id || owner?.id) : !person?.id}
            accessibilityRole="button"
            accessibilityLabel={t('chat.peerProfile')}
          >
            <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
          {listing ? (
            <Pressable onPress={openListing} disabled={!conversation?.apartment_id}>
              <Text style={[styles.sub, rtlText, { color: colors.primary }]} numberOfLines={1}>
                {listing}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {listingPhoto ? (
          <Pressable onPress={openListing} disabled={!conversation?.apartment_id}>
            <Image
              source={{ uri: listingPhoto }}
              style={[styles.listingPhoto, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
            />
          </Pressable>
        ) : null}
        {bookingId && !admin ? (
          <Pressable
            onPress={openBooking}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('chat.viewBooking')}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
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

      <Modal visible={adminPickOpen} transparent animationType="fade" onRequestClose={closeAdminPick}>
        <View
          {...adminPickBack}
          style={[
            styles.pickOverlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: Math.max(safe.top, spacing.lg),
              paddingBottom: Math.max(safe.bottom, spacing.lg),
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAdminPick} />
          <View style={[styles.pickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pickTitle, rtlText, { color: colors.text }]}>{t('chat.peerProfile')}</Text>
            <Text style={[styles.pickHint, rtlText, { color: colors.textMuted }]}>{t('admin.pickChatProfile')}</Text>
            {student?.id ? (
              <Pressable
                onPress={() => openPeer(student)}
                style={({ pressed }) => [
                  styles.pickRow,
                  row,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Ionicons name="school-outline" size={18} color={colors.primary} />
                <View style={styles.pickCopy}>
                  <Text style={[styles.pickName, rtlText, { color: colors.text }]} numberOfLines={1}>
                    {personName(student) || seekerRoleLabel(student.role, t)}
                  </Text>
                  <Text style={[styles.pickRole, rtlText, { color: colors.textMuted }]}>
                    {seekerRoleLabel(student.role, t)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
            {owner?.id ? (
              <Pressable
                onPress={() => openPeer(owner)}
                style={({ pressed }) => [
                  styles.pickRow,
                  row,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Ionicons name="home-outline" size={18} color={colors.primary} />
                <View style={styles.pickCopy}>
                  <Text style={[styles.pickName, rtlText, { color: colors.text }]} numberOfLines={1}>
                    {personName(owner) || t('roles.owner')}
                  </Text>
                  <Text style={[styles.pickRole, rtlText, { color: colors.textMuted }]}>{t('roles.owner')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <ChatPeerSheet
        visible={peerOpen}
        userId={peerPick?.id}
        viewerId={profile?.id}
        adminReview={admin}
        seed={peerPick}
        onClose={() => {
          setPeerOpen(false);
          setPeerPick(null);
        }}
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
  pickOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    zIndex: 1,
  },
  pickTitle: { fontSize: 17, fontFamily: 'Cairo_800ExtraBold' },
  pickHint: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginBottom: 4 },
  pickRow: {
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pickCopy: { flex: 1, minWidth: 0, gap: 2 },
  pickName: { fontSize: 14, fontFamily: 'Cairo_800ExtraBold' },
  pickRole: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
});
