import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { StatusFilters } from '@/components/booking/StatusFilters';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { StarRow } from '@/components/reviews/StarRow';
import { Button } from '@/components/ui/Button';
import { HubRow } from '@/components/ui/HubRow';
import { NoteModal } from '@/components/ui/NoteModal';
import { Pager } from '@/components/ui/Pager';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { openListingChat } from '@/src/lib/chat';
import { currentStudentStay } from '@/src/lib/booking';
import { formatStayRange, localizedPair, localizedTitle } from '@/src/lib/format';
import { notifyUser } from '@/src/lib/push';
import { submitAppReport } from '@/src/lib/reports';
import { bookingCopyText, detachCancelledStayChat, postBookingChat } from '@/src/lib/stayActions';
import { listingPlaceLine } from '@/src/lib/listingPlace';
import { displayName } from '@/src/lib/name';
import { attachStayPeerCards } from '@/src/lib/ownerPublic';
import { alert } from '@/src/lib/notice';
import { BOOKING_PAGE_SIZE, paginate } from '@/src/lib/page';
import { canShowOwnerContact } from '@/src/lib/privacy';
import { canReviewStay, isValidReview, loadMyReviews, submitApartmentReview } from '@/src/lib/reviews';
import { pendingExpireHoursLeft } from '@/src/lib/searchAlerts';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, ApartmentReview, Booking, BookingStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function StudentBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const today = useToday();
  const { focus, review } = useLocalSearchParams<{ focus?: string; review?: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<ApartmentReview[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [noteKind, setNoteKind] = useState<'cancelStay' | 'issue' | null>(null);
  const [noteBooking, setNoteBooking] = useState<Booking | null>(null);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select(`*, apartments(*, cities(*))`)
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });
    setBookings(await attachStayPeerCards((data as Booking[]) ?? [], 'owner'));
    if (profile) {
      try {
        setReviews(await loadMyReviews(profile.id));
      } catch {
        setReviews([]);
      }
    }
  }, [profile]);

  const { refreshing, refresh } = useLiveReload(
    load,
    ['bookings', 'apartment_reviews'],
    `student-bookings:${profile?.id ?? ''}`,
  );
  const reviewByBooking = useMemo(
    () => Object.fromEntries(reviews.map((item) => [item.booking_id, item])),
    [reviews],
  );

  const needsReview = useMemo(
    () => bookings.filter((item) => canReviewStay(item) && !reviewByBooking[item.id]),
    [bookings, reviewByBooking],
  );

  useEffect(() => {
    if (!focus && !review) return;
    const id = String(review || focus);
    setHighlightId(id);
    const target = bookings.find((item) => item.id === id);
    if (target) {
      setFilter(target.status);
      setPage(0);
    }
    if (target && canReviewStay(target) && !reviewByBooking[target.id]) {
      setReviewing(target);
      setReviewStars(5);
      setReviewNote('');
      setReviewError('');
    }
  }, [bookings, focus, review, reviewByBooking]);

  const counts = useMemo(() => {
    const next: Record<Filter, number> = {
      all: bookings.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const item of bookings) next[item.status] += 1;
    return next;
  }, [bookings]);

  const filtered = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((item) => item.status === filter)),
    [bookings, filter],
  );
  const currentStay = useMemo(() => currentStudentStay(bookings, today), [bookings, today]);
  const showCurrent = Boolean(currentStay && (filter === 'all' || currentStay.status === filter));
  const rest = useMemo(() => {
    if (!showCurrent || !currentStay) return filtered;
    return filtered.filter((item) => item.id !== currentStay.id);
  }, [filtered, showCurrent, currentStay]);
  const { pages, current, slice: visible, from, to, total } = paginate(rest, page, BOOKING_PAGE_SIZE);

  const pickFilter = (next: Filter) => {
    setFilter(next);
    setPage(0);
  };

  const cancel = (booking: Booking) => {
    if (booking.status === 'confirmed') {
      setNoteBooking(booking);
      setNote('');
      setNoteKind('cancelStay');
      return;
    }
    alert(t('booking.cancelRequest'), t('booking.confirmCancel'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
          if (error) alert(t('common.error'), error.message);
          else {
            void detachCancelledStayChat(booking);
            void load();
          }
        },
      },
    ]);
  };

  const shareStay = async (booking: Booking) => {
    try {
      await Share.share({ message: bookingCopyText(booking, t, i18n.language) });
    } catch {
      // dismissed
    }
  };

  const agreeStay = async (booking: Booking) => {
    if (!profile) return;
    setBusyId(booking.id);
    try {
      const body = `${t('booking.agreeStay')}\n\n${bookingCopyText(booking, t, i18n.language)}`;
      await postBookingChat(booking, profile.id, body);
      alert(t('common.done'), t('booking.agreeStaySent'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const requestExtend = (booking: Booking) => {
    alert(t('booking.extendStay'), t('booking.extendStayAsk'), [
      { text: t('booking.extendMonths', { count: 1 }), onPress: () => void sendExtendAsk(booking, 1) },
      { text: t('booking.extendMonths', { count: 2 }), onPress: () => void sendExtendAsk(booking, 2) },
      { text: t('booking.extendMonths', { count: 3 }), onPress: () => void sendExtendAsk(booking, 3) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const sendExtendAsk = async (booking: Booking, extra: number) => {
    if (!profile) return;
    setBusyId(booking.id);
    try {
      await postBookingChat(
        booking,
        profile.id,
        t('booking.extendStayAsk') +
          ` ${t('booking.extendMonths', { count: extra })} · ${formatStayRange(booking.start_date, booking.months, i18n.language)}`,
      );
      if (booking.owner_id) {
        void notifyUser(booking.owner_id, t('booking.extendStay'), t('booking.extendStaySent'), 'booking', {
          bookingId: booking.id,
        });
      }
      alert(t('common.done'), t('booking.extendStaySent'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const submitNote = async () => {
    if (!profile || !noteBooking || !noteKind) return;
    const body = note.trim();
    if (noteKind === 'cancelStay' && body.length < 4) {
      alert(t('common.error'), t('booking.cancelStayReason'));
      return;
    }
    if (noteKind === 'issue' && body.length < 8) {
      alert(t('common.error'), t('listing.reportShort'));
      return;
    }
    setNoteBusy(true);
    try {
      if (noteKind === 'cancelStay') {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'cancelled', cancel_reason: body })
          .eq('id', noteBooking.id);
        if (error) throw error;
        if (noteBooking.owner_id) {
          void notifyUser(noteBooking.owner_id, t('booking.cancelStay'), body, 'booking', {
            bookingId: noteBooking.id,
          });
        }
        await detachCancelledStayChat(noteBooking);
        void load();
      } else {
        await submitAppReport(profile.id, {
          kind: 'safety',
          subject: t('booking.stayIssue'),
          body,
          targetApartmentId: noteBooking.apartment_id,
          targetUserId: noteBooking.owner_id,
        });
        await postBookingChat(noteBooking, profile.id, `${t('booking.stayIssue')}: ${body}`);
        alert(t('common.done'), t('booking.stayIssueSent'));
      }
      setNoteKind(null);
      setNoteBooking(null);
      setNote('');
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setNoteBusy(false);
    }
  };

  const messageOwner = async (booking: Booking) => {
    if (!profile || !booking.apartments) return;
    setBusyId(booking.id);
    try {
      const conversationId = await openListingChat(booking.apartments as Apartment, profile);
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === t('chat.blockedOpen')) {
        alert(t('common.error'), message, [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('chat.blockedManage'),
            onPress: () => router.push({ pathname: '/(student)/(tabs)/profile', params: { tab: 'security' } }),
          },
        ]);
      } else {
        alert(t('common.error'), message);
      }
    } finally {
      setBusyId(null);
    }
  };

  const openReview = (booking: Booking) => {
    const existing = reviewByBooking[booking.id];
    setReviewError('');
    setReviewing(booking);
    setReviewStars(existing?.stars ?? 5);
    setReviewNote(existing?.note ?? '');
  };

  const closeReview = () => {
    setReviewing(null);
    setReviewError('');
  };

  const saveReview = async () => {
    if (!profile || !reviewing) return;
    if (!isValidReview(reviewStars, reviewNote)) {
      setReviewError(t('review.invalid'));
      return;
    }
    setReviewBusy(true);
    setReviewError('');
    const apartmentId = reviewing.apartment_id;
    try {
      await submitApartmentReview({
        booking: reviewing,
        studentId: profile.id,
        authorName: displayName(profile, i18n.language) || profile.full_name,
        stars: reviewStars,
        note: reviewNote,
        existingId: reviewByBooking[reviewing.id]?.id,
      });
      closeReview();
      await load();
      alert(t('review.postedTitle'), t('review.postedBody'), [
        { text: t('common.done'), style: 'cancel' },
        {
          text: t('review.viewOnListing'),
          onPress: () =>
            router.push({
              pathname: '/(student)/apartment/[id]',
              params: { id: apartmentId, focus: 'reviews' },
            }),
        },
      ]);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : t('review.failed'));
    } finally {
      setReviewBusy(false);
    }
  };

  const payVisa = (id: string) => {
    alert(t('booking.payNow'), t('booking.confirmVisa'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          const { error } = await supabase.from('bookings').update({ payment_status: 'paid' }).eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else {
            alert(t('common.done'), t('booking.paidOk'));
            void load();
          }
        },
      },
    ]);
  };

  const renderStay = (booking: Booking, featured: boolean) => {
    const showPhone = canShowOwnerContact(booking.profiles, 'phone', { bookingStatus: booking.status });
    const phone = showPhone ? booking.profiles?.phone : null;
    const myReview = reviewByBooking[booking.id];
    const checkIn = localizedPair(
      booking.apartments?.check_in_notes_ar,
      booking.apartments?.check_in_notes_en,
      i18n.language,
    );
    const houseRules = localizedPair(
      booking.apartments?.house_rules_ar,
      booking.apartments?.house_rules_en,
      i18n.language,
    );
    const stayNote =
      booking.status === 'confirmed' || booking.status === 'completed'
        ? [
            checkIn ? `${t('listing.checkIn')}\n${checkIn}` : '',
            houseRules ? `${t('listing.houseRules')}\n${houseRules}` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : '';
    const unpaidVisa =
      (booking.payment_method === 'visa' || booking.payment_method === 'pay_now') &&
      booking.payment_status === 'unpaid' &&
      booking.status !== 'cancelled';
    const reviewable = canReviewStay(booking);
    const expanded = Boolean(moreOpen[booking.id]);
    const place = listingPlaceLine(booking.apartments, t);
    const range = formatStayRange(booking.start_date, booking.months, i18n.language);
    const extra = [place, featured ? range : null].filter(Boolean).join(' · ') || undefined;
    const hasMore =
      Boolean(phone) ||
      booking.status === 'pending' ||
      booking.status === 'confirmed' ||
      Boolean(myReview);
    return (
      <BookingCard
        key={booking.id}
        booking={booking}
        kicker={featured ? t('menu.activeStay') : undefined}
        highlighted={featured || highlightId === booking.id}
        extra={extra}
        personIcon="home"
        personAvatar={booking.profiles?.avatar_url}
        personLabel={
          booking.profiles
            ? displayName(booking.profiles, i18n.language) || booking.profiles.full_name || undefined
            : undefined
        }
        onViewListingPhoto={
          booking.apartments?.photos?.length
            ? () => setViewer({ photos: booking.apartments!.photos, index: 0 })
            : undefined
        }
        onViewPersonPhoto={
          booking.profiles?.avatar_url
            ? () => setViewer({ photos: [booking.profiles!.avatar_url!], index: 0 })
            : undefined
        }
        noteLines={featured ? 3 : 2}
        nextAction={
          booking.status === 'pending'
            ? t('booking.nextWaitOwner', { hours: pendingExpireHoursLeft(booking.created_at) ?? 0 })
            : unpaidVisa
              ? t('booking.nextPay')
              : canReviewStay(booking) && !myReview
                ? t('booking.nextReview')
                : booking.status === 'confirmed'
                  ? t('booking.nextStay')
                  : booking.status === 'cancelled'
                    ? t('booking.nextCancelled')
                    : booking.status === 'completed'
                      ? t('booking.nextCompleted')
                      : undefined
        }
        nextIcon={
          booking.status === 'pending'
            ? 'hourglass-outline'
            : unpaidVisa
              ? 'card-outline'
              : canReviewStay(booking) && !myReview
                ? 'star-outline'
                : booking.status === 'confirmed'
                  ? 'checkmark-circle-outline'
                  : booking.status === 'cancelled'
                    ? 'close-circle-outline'
                    : 'flag-outline'
        }
        note={
          booking.status === 'cancelled' && booking.cancel_reason
            ? t('booking.cancelledNote', { note: booking.cancel_reason })
            : booking.status === 'pending'
              ? t('booking.pendingStayNotes')
              : featured
                ? stayNote || (booking.status === 'confirmed' ? t('booking.waitCheckIn') : undefined)
                : undefined
        }
      >
        {unpaidVisa ? (
          <>
            <Text style={[styles.myReviewNote, rtlText, { color: colors.textMuted }]}>
              {t('payment.simulated')}
            </Text>
            <Button title={t('booking.markVisaDemo')} compact pill onPress={() => payVisa(booking.id)} />
          </>
        ) : null}
        {reviewable && !myReview ? (
          <Button title={t('review.write')} compact pill onPress={() => openReview(booking)} />
        ) : null}
        <Button
          title={t('booking.messageOwner')}
          variant={unpaidVisa || (reviewable && !myReview) ? 'ghost' : 'secondary'}
          compact
          pill
          loading={busyId === booking.id}
          onPress={() => void messageOwner(booking)}
        />
        {booking.apartment_id ? (
          <Button
            title={t('booking.viewListing')}
            variant="ghost"
            compact
            pill
            onPress={() =>
              router.push({ pathname: '/(student)/apartment/[id]', params: { id: booking.apartment_id } })
            }
          />
        ) : null}
        {expanded ? (
          <>
            {phone ? (
              <Button title={t('common.call')} variant="ghost" compact pill onPress={() => Linking.openURL(`tel:${phone}`)} />
            ) : null}
            {booking.status === 'pending' || booking.status === 'confirmed' ? (
              <Button
                title={t('booking.shareStay')}
                variant="ghost"
                compact
                pill
                onPress={() => void shareStay(booking)}
              />
            ) : null}
            {booking.status === 'confirmed' ? (
              <>
                <Button
                  title={t('booking.agreeStay')}
                  variant="secondary"
                  compact
                  pill
                  loading={busyId === booking.id}
                  onPress={() => void agreeStay(booking)}
                />
                <Button
                  title={t('booking.extendStay')}
                  variant="ghost"
                  compact
                  pill
                  onPress={() => requestExtend(booking)}
                />
                <Button
                  title={t('booking.stayIssue')}
                  variant="ghost"
                  compact
                  pill
                  onPress={() => {
                    setNoteBooking(booking);
                    setNote('');
                    setNoteKind('issue');
                  }}
                />
              </>
            ) : null}
            {myReview ? (
              <View style={[styles.myReview, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                <Text style={[styles.myReviewLabel, rtlText, { color: colors.primaryDark }]}>
                  {t('review.yourReview')}
                </Text>
                <StarRow value={myReview.stars} size={14} />
                <Text style={[styles.myReviewNote, rtlText, { color: colors.text }]} numberOfLines={2}>
                  {myReview.note}
                </Text>
                <Button
                  title={t('review.edit')}
                  variant="ghost"
                  compact
                  pill
                  onPress={() => openReview(booking)}
                />
                <Button
                  title={t('review.viewOnListing')}
                  variant="secondary"
                  compact
                  pill
                  onPress={() =>
                    router.push({
                      pathname: '/(student)/apartment/[id]',
                      params: { id: booking.apartment_id, focus: 'reviews' },
                    })
                  }
                />
              </View>
            ) : null}
            {booking.status === 'pending' ? (
              <Button title={t('booking.cancelRequest')} variant="danger" compact pill onPress={() => cancel(booking)} />
            ) : null}
            {booking.status === 'confirmed' ? (
              <Button title={t('booking.cancelStay')} variant="danger" compact pill onPress={() => cancel(booking)} />
            ) : null}
          </>
        ) : null}
        {hasMore ? (
          <Pressable
            onPress={() => setMoreOpen((current) => ({ ...current, [booking.id]: !expanded }))}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.more, rtlText, { color: colors.primary }]}>
              {expanded ? t('booking.hideActions') : t('booking.moreActions')}
            </Text>
          </Pressable>
        ) : null}
      </BookingCard>
    );
  };

  return (
    <>
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      back={filter !== 'all'}
      onBack={() => setFilter('all')}
    >
      <ProfileEnter scene="bookings" enterOnMount>
      <OfflineBanner />
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('booking.myBookings')}</Text>
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('review.whereHint')}</Text>
        </View>
        {counts.pending > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <Text style={[styles.countText, { color: colors.warning }]}>{counts.pending}</Text>
          </View>
        ) : null}
      </View>

      {needsReview.length > 0 ? (
        <HubRow
          icon="star-outline"
          label={t('review.goWrite')}
          hint={t('profile.itemCount', { count: needsReview.length })}
          dot
          onPress={() => {
            const first = needsReview[0];
            setHighlightId(first.id);
            setReviewing(first);
            setReviewStars(5);
            setReviewNote('');
            setReviewError('');
          }}
        />
      ) : null}

      <StatusFilters value={filter} counts={counts} onChange={pickFilter} />

      {filtered.length === 0 && !showCurrent ? (
        <EmptyState
          title={bookings.length === 0 ? t('booking.empty') : t('booking.emptyFiltered')}
          actionTitle={bookings.length === 0 ? t('booking.findPlace') : undefined}
          onAction={bookings.length === 0 ? () => router.push('/(student)/(tabs)/search') : undefined}
        />
      ) : null}

      {showCurrent && currentStay ? renderStay(currentStay, true) : null}

      {showCurrent && rest.length > 0 ? (
        <Text style={[styles.history, rtlText, { color: colors.textMuted }]}>{t('booking.historyTitle')}</Text>
      ) : null}

      {visible.map((booking) => renderStay(booking, false))}
      <Pager
        page={current}
        pages={pages}
        from={from}
        to={to}
        total={total}
        pageSize={BOOKING_PAGE_SIZE}
        onPage={setPage}
      />
      <ReviewForm
        visible={Boolean(reviewing)}
        title={
          reviewing?.apartments
            ? t('review.formTitle', { title: localizedTitle(reviewing.apartments, i18n.language) })
            : t('review.write')
        }
        stars={reviewStars}
        note={reviewNote}
        error={reviewError}
        loading={reviewBusy}
        onStars={(next) => {
          setReviewError('');
          setReviewStars(next);
        }}
        onNote={(next) => {
          setReviewError('');
          setReviewNote(next);
        }}
        onConfirm={() => void saveReview()}
        onClose={closeReview}
      />
      <NoteModal
        visible={Boolean(noteKind)}
        title={noteKind === 'issue' ? t('booking.stayIssue') : t('booking.cancelStay')}
        label={noteKind === 'issue' ? t('profile.reportDetails') : t('booking.cancelStayReason')}
        hint={noteKind === 'issue' ? t('booking.stayIssueHint') : t('booking.confirmCancelStay')}
        value={note}
        confirmTitle={noteKind === 'issue' ? t('booking.stayIssue') : t('booking.cancelStay')}
        loading={noteBusy}
        onChange={setNote}
        onConfirm={() => void submitNote()}
        onClose={() => {
          if (noteBusy) return;
          setNoteKind(null);
          setNoteBooking(null);
          setNote('');
        }}
      />
      </ProfileEnter>
    </Screen>
    <PhotoViewer
      photos={viewer?.photos ?? []}
      index={viewer?.index ?? 0}
      visible={Boolean(viewer?.photos.length)}
      onIndexChange={(index) => setViewer((current) => (current ? { ...current, index } : current))}
      onClose={() => setViewer(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  countPill: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  countText: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  myReview: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 6,
  },
  myReviewLabel: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  myReviewNote: { fontSize: 13, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
  more: { fontSize: 12, fontFamily: 'Cairo_700Bold', paddingVertical: 4 },
  history: { fontSize: 12, fontFamily: 'Cairo_700Bold', marginTop: 4 },
});
