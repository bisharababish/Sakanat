import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StatusFilters } from '@/components/booking/StatusFilters';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { IdDocsViewer } from '@/components/profile/IdDocsViewer';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { bookingGateCode, hasConfirmedOverlap, overlappingBookings } from '@/src/lib/booking';
import { openConversation, sendMessage } from '@/src/lib/chat';
import { majorLabel } from '@/src/data/majors';
import { ageLabel, bookingStatusLabel, bookingTone, formatIls, formatStayRange, localizedName, localizedPair, localizedTitle } from '@/src/lib/format';
import { buildingKey, listingPlaceLine, uniqueBuildings } from '@/src/lib/listingPlace';
import { listingHasCheckIn, loadCheckInSentIds, markCheckInSent, stayCheckInChatBody } from '@/src/lib/listingStay';
import { seekerExtraIcon, seekerMessageKey, seekerRoleLabel } from '@/src/lib/seeker';
import { applyStayExtension, bookingCopyText, detachCancelledStayChat, postBookingChat } from '@/src/lib/stayActions';
import { alert } from '@/src/lib/notice';
import { BOOKING_PAGE_SIZE, paginate } from '@/src/lib/page';
import { canShowSeekerContact } from '@/src/lib/privacy';
import { notifyUser } from '@/src/lib/push';
import { pendingExpireHoursLeft } from '@/src/lib/searchAlerts';
import { SEEKER_BOOKING_PROFILE, seekerTrustDetails } from '@/src/lib/trust';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, Booking, BookingStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function OwnerBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const safe = useModalSafeArea();
  const { profile } = useAuth();
  const { cities, universities } = useCatalog();
  const today = useToday();
  const { focus, listing } = useLocalSearchParams<{ focus?: string; listing?: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [buildingFilter, setBuildingFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<'message' | 'checkin' | null>(null);
  const [checkInSent, setCheckInSent] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingBusy, setRejectingBusy] = useState(false);
  const [docsFor, setDocsFor] = useState<Booking | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [listingFilter, setListingFilter] = useState<string | null>(null);
  const closeReject = () => setRejecting(null);
  const rejectBack = useEdgeBack(Boolean(rejecting), closeReject);
  const scrollRef = useRef<ScrollView>(null);
  const yById = useRef<Record<string, number>>({});

  useEffect(() => {
    void loadCheckInSentIds().then(setCheckInSent);
  }, []);

  useEffect(() => {
    if (!focus) return;
    const id = String(focus);
    setOpenId(id);
    setFilter('all');
    setBuildingFilter('all');
    setListingFilter(null);
  }, [focus]);

  useEffect(() => {
    if (!listing) return;
    setListingFilter(String(listing));
    setFilter('all');
    setBuildingFilter('all');
  }, [listing]);

  useEffect(() => {
    if (!focus) return;
    const id = String(focus);
    const index = bookings.findIndex((item) => item.id === id);
    if (index >= 0) setPage(Math.floor(index / BOOKING_PAGE_SIZE));
  }, [bookings, focus]);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select(
        `*, apartments(*, cities(*)), profiles!student_id(${SEEKER_BOOKING_PROFILE})`,
      )
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
  }, [profile]);

  const { refreshing, refresh } = useLiveReload(load, ['bookings'], `owner-bookings:${profile?.id ?? ''}`);

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

  const buildings = useMemo(
    () =>
      uniqueBuildings(
        bookings.flatMap((item) => (item.apartments ? [item.apartments] : [])),
        i18n.language,
        t('owner.untitledUnit'),
      ),
    [bookings, i18n.language, t],
  );

  const filtered = useMemo(() => {
    const byStatus = filter === 'all' ? bookings : bookings.filter((item) => item.status === filter);
    const byListing = listingFilter ? byStatus.filter((item) => item.apartment_id === listingFilter) : byStatus;
    if (buildingFilter === 'all') return byListing;
    return byListing.filter((item) => item.apartments && buildingKey(item.apartments) === buildingFilter);
  }, [bookings, buildingFilter, filter, listingFilter]);
  const { pages, current, slice: visible, from, to, total } = paginate(filtered, page, BOOKING_PAGE_SIZE);

  useEffect(() => {
    if (!focus) return;
    const id = String(focus);
    let tries = 0;
    const tick = () => {
      const y = yById.current[id];
      if (y != null) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
        return;
      }
      if (tries++ < 16) setTimeout(tick, 50);
    };
    tick();
  }, [focus, page, visible]);

  const pickFilter = (next: Filter) => {
    setFilter(next);
    setPage(0);
  };

  const pickBuilding = (next: string) => {
    setBuildingFilter(next);
    setPage(0);
  };

  const applyStatus = async (booking: Booking, status: BookingStatus, cancelReason?: string | null) => {
    const patch: { status: BookingStatus; cancel_reason?: string | null } = { status };
    if (status === 'cancelled') patch.cancel_reason = cancelReason?.trim() || null;
    const { error } = await supabase.from('bookings').update(patch).eq('id', booking.id);
    if (error) {
      if (bookingGateCode(error) === 'BOOKING_LISTING_OCCUPIED') {
        alert(t('booking.occupiedTitle'), t('owner.overlapBody'));
      } else {
        alert(t('common.error'), error.message);
      }
      return;
    }
    if (status === 'confirmed' && booking.student_id) {
      void notifyUser(booking.student_id, t('push.bookingApprovedTitle'), t('push.bookingApprovedBody'), 'booking');

    }
    if (status === 'cancelled' && booking.student_id) {
      void notifyUser(booking.student_id, t('push.bookingRejectedTitle'), t('push.bookingRejectedBody'), 'booking');
      void detachCancelledStayChat(booking);
    }
    void load();
  };

  const updateStatus = (booking: Booking, status: BookingStatus) => {
    if (status === 'confirmed' && hasConfirmedOverlap(booking, bookings)) {
      alert(t('booking.occupiedTitle'), t('owner.overlapBody'));
      return;
    }
    void applyStatus(booking, status);
  };

  const submitReject = async () => {
    if (!rejecting) return;
    setRejectingBusy(true);
    try {
      await applyStatus(rejecting, 'cancelled', rejectNote);
      setRejecting(null);
      setRejectNote('');
    } finally {
      setRejectingBusy(false);
    }
  };

  const shareStay = async (booking: Booking) => {
    try {
      await Share.share({ message: bookingCopyText(booking, t, i18n.language) });
    } catch {
      // dismissed
    }
  };

  const extendStay = (booking: Booking) => {
    alert(t('booking.extendStay'), t('booking.extendStayAsk'), [
      { text: t('booking.extendMonths', { count: 1 }), onPress: () => void applyExtend(booking, 1) },
      { text: t('booking.extendMonths', { count: 2 }), onPress: () => void applyExtend(booking, 2) },
      { text: t('booking.extendMonths', { count: 3 }), onPress: () => void applyExtend(booking, 3) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const applyExtend = async (booking: Booking, extra: number) => {
    if (!profile) return;
    setBusyId(booking.id);
    setBusyKind('message');
    try {
      const next = await applyStayExtension(booking, extra);
      await postBookingChat(
        { ...booking, ...next },
        profile.id,
        `${t('booking.extendStayDone')} · ${formatStayRange(next.start_date, next.months, i18n.language)}`,
      );
      if (booking.student_id) {
        void notifyUser(booking.student_id, t('booking.extendStay'), t('booking.extendStayDone'), 'booking', {
          bookingId: booking.id,
        });
      }
      alert(t('common.done'), t('booking.extendStayDone'));
      void load();
    } catch (err) {
      if (bookingGateCode(err) === 'BOOKING_LISTING_OCCUPIED') {
        alert(t('booking.occupiedTitle'), t('owner.overlapBody'));
      } else {
        alert(t('common.error'), err instanceof Error ? err.message : '');
      }
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  const messageStudent = async (booking: Booking) => {
    if (!booking.apartments || !booking.student_id) return;
    setBusyId(booking.id);
    setBusyKind('message');
    try {
      const conversationId = await openConversation(booking.apartments as Apartment, booking.student_id);
      router.push({ pathname: '/(owner)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  const sendCheckIn = async (booking: Booking, force = false) => {
    if (!profile || !booking.apartments || !booking.student_id) return;
    if (!listingHasCheckIn(booking.apartments)) {
      alert(t('owner.checkInMissing'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.edit'),
          onPress: () =>
            router.push({ pathname: '/(owner)/listing/[id]', params: { id: booking.apartments!.id } }),
        },
      ]);
      return;
    }
    if (!force && checkInSent.has(booking.id)) {
      alert(t('owner.checkInAlready'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('owner.sendCheckInAgain'), onPress: () => void sendCheckIn(booking, true) },
      ]);
      return;
    }
    const body = stayCheckInChatBody(booking.apartments, t, i18n.language);
    if (!body) return;
    setBusyId(booking.id);
    setBusyKind('checkin');
    try {
      const conversationId = await openConversation(booking.apartments as Apartment, booking.student_id);
      await sendMessage(conversationId, profile.id, body);
      await markCheckInSent(booking.id);
      setCheckInSent((prev) => new Set(prev).add(booking.id));
      alert(t('common.done'), t('owner.checkInSent'));
      router.push({ pathname: '/(owner)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  return (
    <Screen
      scrollRef={scrollRef}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      back={filter !== 'pending' || buildingFilter !== 'all' || Boolean(focus) || Boolean(listingFilter)}
      onBack={() => {
        if (focus) {
          const row = bookings.find((item) => item.id === String(focus));
          setOpenId(null);
          setBuildingFilter('all');
          setListingFilter(null);
          pickFilter(row?.status ?? 'all');
          router.setParams({ focus: undefined, listing: undefined });
          return;
        }
        setBuildingFilter('all');
        setListingFilter(null);
        pickFilter('pending');
      }}
    >
      <OfflineBanner />
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.bookings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('booking.incoming')}</Text>
        </View>
        <Button
          title={t('owner.occupantsTitle')}
          variant="ghost"
          compact
          pill
          onPress={() => router.push({ pathname: '/(owner)/(tabs)/profile', params: { tab: 'occupants' } })}
        />
        {counts.pending > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <Text style={[styles.countText, { color: colors.warning }]}>{counts.pending}</Text>
          </View>
        ) : null}
      </View>

      <StatusFilters value={filter} counts={counts} onChange={pickFilter} />
      {buildings.length > 1 ? (
        <FilterPills
          compact
          value={buildingFilter}
          onChange={pickBuilding}
          items={[
            { value: 'all', label: t('owner.allBuildings'), count: bookings.length },
            ...buildings.map((item) => ({ value: item.key, label: item.name, count: item.count })),
          ]}
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={bookings.length === 0 ? t('booking.emptyIncoming') : t('booking.emptyFiltered')}
        />
      ) : null}

      {visible.map((booking) => {
        const open = openId === booking.id;
        const showPhone = canShowSeekerContact(booking.profiles, 'phone', { bookingStatus: booking.status });
        const phone = showPhone ? booking.profiles?.phone : null;
        const gender = booking.profiles?.gender;
        const role = booking.profiles?.role;
        const university = universities.find((item) => item.id === booking.profiles?.university_id);
        const city = cities.find((item) => item.id === booking.profiles?.city_id);
        const extraName =
          role === 'renter'
            ? localizedName(city, i18n.language)
            : localizedName(university, i18n.language);
        const personBits = [
          booking.profiles?.full_name,
          gender === 'male' ? t('profile.male') : gender === 'female' ? t('profile.female') : '',
          ageLabel(booking.profiles?.date_of_birth, t, today),
          seekerRoleLabel(role, t),
        ].filter(Boolean);
        const yearKey = booking.profiles?.study_year;
        const yearLabel = yearKey && /^[1-6]$/.test(yearKey) ? t(`profile.year${yearKey}` as 'profile.year1') : '';
        const details = [
          booking.profiles?.major ? majorLabel(booking.profiles.major, i18n.language) : '',
          booking.profiles?.degree_level === 'bachelor'
            ? t('profile.bachelor')
            : booking.profiles?.degree_level === 'master'
              ? t('profile.master')
              : booking.profiles?.degree_level === 'doctorate'
                ? t('profile.doctorate')
                : booking.profiles?.degree_level === 'diploma'
                  ? t('profile.diploma')
                  : booking.profiles?.degree_level
                    ? t('profile.otherDegree')
                    : '',
          yearLabel,
          booking.profiles?.student_id_number
            ? `${t('profile.studentId')} ${booking.profiles.student_id_number}`
            : '',
          ...seekerTrustDetails(booking.profiles, t),
        ].filter(Boolean);
        const overlapConfirmed = hasConfirmedOverlap(booking, bookings);
        const overlapPending =
          booking.status === 'pending' && overlappingBookings(booking, bookings, ['pending']).length > 0;
        const photo = booking.apartments?.photos?.[0];
        const title = localizedTitle(booking.apartments, i18n.language);
        const place = listingPlaceLine(booking.apartments, t);
        const warning =
          booking.status === 'pending' && overlapConfirmed
            ? t('owner.overlapWarn')
            : booking.status === 'pending' && overlapPending
              ? t('owner.overlapPending')
              : undefined;
        return (
          <View
            key={booking.id}
            onLayout={(event) => {
              yById.current[booking.id] = event.nativeEvent.layout.y;
            }}
            style={[
              styles.rowCard,
              {
                backgroundColor: colors.surface,
                borderColor: String(focus) === booking.id ? colors.primary : colors.border,
                borderWidth: String(focus) === booking.id ? 2 : 1,
              },
            ]}
          >
            <Pressable
              onPress={() => setOpenId(open ? null : booking.id)}
              style={[styles.rowMain, row]}
              accessibilityRole="button"
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="home-outline" size={18} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, rtlText, { color: colors.text }]} numberOfLines={1}>
                  {personBits[0] || title}
                </Text>
                <Text style={[styles.rowMeta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
                  {[place, title, formatIls(booking.rent_amount, i18n.language)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <StatusBadge label={bookingStatusLabel(booking.status, t)} tone={bookingTone(booking.status)} />
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>

            {open ? (
              <View style={styles.rowActions}>
                {personBits.length > 1 ? (
                  <Text style={[styles.detailLine, rtlText, { color: colors.textMuted }]}>
                    {personBits.slice(1).join(' · ')}
                  </Text>
                ) : null}
                {extraName ? (
                  <View style={[styles.chipLine, row]}>
                    <Ionicons name={seekerExtraIcon(role)} size={14} color={colors.primary} />
                    <Text style={[styles.detailLine, rtlText, { color: colors.text }]}>{extraName}</Text>
                  </View>
                ) : null}
                <Text style={[styles.detailLine, rtlText, { color: colors.textMuted }]}>
                  {formatStayRange(booking.start_date, booking.months, i18n.language)} · {booking.months}{' '}
                  {booking.months === 1 ? t('common.month') : t('common.months')}
                </Text>
                {details.map((line) => (
                  <Text key={line} style={[styles.detailLine, rtlText, { color: colors.textMuted }]}>
                    {line}
                  </Text>
                ))}
                {warning ? (
                  <Text style={[styles.detailLine, rtlText, { color: colors.warning }]}>{warning}</Text>
                ) : null}
                {booking.status === 'cancelled' && booking.cancel_reason ? (
                  <Text style={[styles.detailLine, rtlText, { color: colors.textMuted }]}>
                    {t('booking.cancelledNote', { note: booking.cancel_reason })}
                  </Text>
                ) : null}
                {localizedPair(
                  booking.apartments?.check_in_notes_ar,
                  booking.apartments?.check_in_notes_en,
                  i18n.language,
                ) ? (
                  <Text style={[styles.detailLine, rtlText, { color: colors.text }]}>
                    {t('listing.checkIn')}
                    {'\n'}
                    {localizedPair(
                      booking.apartments?.check_in_notes_ar,
                      booking.apartments?.check_in_notes_en,
                      i18n.language,
                    )}
                  </Text>
                ) : null}
                {localizedPair(
                  booking.apartments?.house_rules_ar,
                  booking.apartments?.house_rules_en,
                  i18n.language,
                ) ? (
                  <Text style={[styles.detailLine, rtlText, { color: colors.text }]}>
                    {t('listing.houseRules')}
                    {'\n'}
                    {localizedPair(
                      booking.apartments?.house_rules_ar,
                      booking.apartments?.house_rules_en,
                      i18n.language,
                    )}
                  </Text>
                ) : null}
                {localizedPair(
                  booking.apartments?.check_in_notes_ar,
                  booking.apartments?.check_in_notes_en,
                  i18n.language,
                ) ||
                localizedPair(
                  booking.apartments?.house_rules_ar,
                  booking.apartments?.house_rules_en,
                  i18n.language,
                ) ? (
                  <Text style={[styles.detailLine, rtlText, { color: colors.textMuted }]}>
                    {t('owner.stayStudentSees')}
                  </Text>
                ) : null}

                {booking.status === 'pending' ? (
                  <Text style={[styles.detailLine, rtlText, { color: colors.warning }]}>
                    {t('booking.pendingExpire', {
                      hours: pendingExpireHoursLeft(booking.created_at) ?? 0,
                    })}
                  </Text>
                ) : null}
                  {booking.status === 'pending' ? (
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <Button title={t('admin.approve')} compact pill onPress={() => updateStatus(booking, 'confirmed')} />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        title={t('admin.reject')}
                        variant="danger"
                        compact
                        pill
                        onPress={() => {
                          setRejectNote('');
                          setRejecting(booking);
                        }}
                      />
                    </View>
                  </View>
                ) : null}
                {booking.status === 'confirmed' ? (
                  <>
                    <Button title={t('booking.complete')} compact pill onPress={() => updateStatus(booking, 'completed')} />
                    <Button title={t('booking.extendStay')} variant="secondary" compact pill onPress={() => extendStay(booking)} />
                  </>
                ) : null}
                <View style={[styles.contact, row]}>
                  {booking.status === 'pending' || booking.status === 'confirmed' ? (
                    <Button
                      title={checkInSent.has(booking.id) ? t('owner.checkInSent') : t('owner.sendCheckIn')}
                      variant={checkInSent.has(booking.id) ? 'ghost' : 'secondary'}
                      compact
                      pill
                      loading={busyId === booking.id && busyKind === 'checkin'}
                      onPress={() => void sendCheckIn(booking)}
                    />
                  ) : null}
                  <Button
                    title={t(seekerMessageKey(role))}
                    variant="secondary"
                    compact
                    pill
                    loading={busyId === booking.id && busyKind === 'message'}
                    onPress={() => void messageStudent(booking)}
                  />
                  {booking.status === 'pending' || booking.status === 'confirmed' ? (
                    <Button
                      title={t('booking.shareStay')}
                      variant="ghost"
                      compact
                      pill
                      onPress={() => void shareStay(booking)}
                    />
                  ) : null}
                  {phone ? (
                    <Button title={t('common.call')} variant="ghost" compact pill onPress={() => Linking.openURL(`tel:${phone}`)} />
                  ) : null}
                  {booking.profiles?.national_id_url || booking.profiles?.university_card_url ? (
                    <Button title={t('profile.viewIdCards')} variant="ghost" compact pill onPress={() => setDocsFor(booking)} />
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      <Pager
        page={current}
        pages={pages}
        from={from}
        to={to}
        total={total}
        pageSize={BOOKING_PAGE_SIZE}
        onPage={setPage}
      />

      <Modal
        visible={Boolean(rejecting)}
        transparent
        animationType="fade"
        onRequestClose={closeReject}
      >
        <View
          {...rejectBack}
          style={[
            styles.overlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: Math.max(safe.top, spacing.lg),
              paddingBottom: Math.max(safe.bottom, spacing.lg),
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeReject} />
          <View style={[styles.rejectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.rejectTitle, rtlText, { color: colors.primaryDark }]}>{t('booking.rejectConfirm')}</Text>
            <Input
              label={t('booking.rejectNote')}
              value={rejectNote}
              onChangeText={setRejectNote}
              hint={t('booking.rejectNoteHint')}
              multiline
            />
            <Button title={t('admin.reject')} variant="danger" pill loading={rejectingBusy} onPress={() => void submitReject()} />
            <Button title={t('common.cancel')} variant="ghost" pill onPress={closeReject} />
          </View>
        </View>
      </Modal>
      <IdDocsViewer
        visible={Boolean(docsFor)}
        nationalPath={docsFor?.profiles?.national_id_url}
        universityPath={docsFor?.profiles?.university_card_url}
        onClose={() => setDocsFor(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
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
  actions: { flexDirection: 'row', gap: 8 },
  contact: { flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  rowCard: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  rowMain: { alignItems: 'center', gap: 10, padding: 10 },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 14, fontFamily: 'Cairo_800ExtraBold' },
  rowMeta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  rowActions: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  detailLine: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
  chipLine: { alignItems: 'center', gap: 6 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  rejectCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    zIndex: 1,
  },
  rejectTitle: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
});
