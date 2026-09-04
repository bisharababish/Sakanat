import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { StatusFilters } from '@/components/booking/StatusFilters';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { hasConfirmedOverlap, overlappingBookings } from '@/src/lib/booking';
import { openConversation } from '@/src/lib/chat';
import { majorLabel } from '@/src/data/majors';
import { ageLabel, localizedName } from '@/src/lib/format';
import { seekerExtraIcon, seekerIcon, seekerMessageKey, seekerRoleLabel } from '@/src/lib/seeker';
import { alert } from '@/src/lib/notice';
import { BOOKING_PAGE_SIZE, paginate } from '@/src/lib/page';
import { whatsappLink } from '@/src/lib/phone';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, Booking, BookingStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function OwnerBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const { cities, universities } = useCatalog();
  const today = useToday();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingBusy, setRejectingBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select(
        '*, apartments(*, cities(*)), profiles!student_id(id, full_name, avatar_url, phone, whatsapp, gender, university_id, city_id, role, major, study_year, student_id_number, date_of_birth)',
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

  const filtered = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((item) => item.status === filter)),
    [bookings, filter],
  );
  const { pages, current, slice: visible, from, to, total } = paginate(filtered, page, BOOKING_PAGE_SIZE);

  const pickFilter = (next: Filter) => {
    setFilter(next);
    setPage(0);
  };

  const applyStatus = async (booking: Booking, status: BookingStatus, cancelReason?: string | null) => {
    const patch: { status: BookingStatus; cancel_reason?: string | null } = { status };
    if (status === 'cancelled') patch.cancel_reason = cancelReason?.trim() || null;
    const { error } = await supabase.from('bookings').update(patch).eq('id', booking.id);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    if (status === 'confirmed' && booking.student_id) {
      void notifyUser(booking.student_id, t('push.bookingApprovedTitle'), t('push.bookingApprovedBody'));
    }
    if (status === 'cancelled' && booking.student_id) {
      void notifyUser(booking.student_id, t('push.bookingRejectedTitle'), t('push.bookingRejectedBody'));
    }
    void load();
  };

  const updateStatus = (booking: Booking, status: BookingStatus) => {
    if (status === 'confirmed' && hasConfirmedOverlap(booking, bookings)) {
      alert(t('owner.overlapTitle'), t('owner.overlapBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('owner.approveAnyway'), onPress: () => void applyStatus(booking, 'confirmed') },
      ]);
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

  const messageStudent = async (booking: Booking) => {
    if (!booking.apartments || !booking.student_id) return;
    setBusyId(booking.id);
    try {
      const conversationId = await openConversation(booking.apartments as Apartment, booking.student_id);
      router.push({ pathname: '/(owner)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.bookings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('booking.incoming')}</Text>
        </View>
        {counts.pending > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <Text style={[styles.countText, { color: colors.warning }]}>{counts.pending}</Text>
          </View>
        ) : null}
      </View>

      <StatusFilters value={filter} counts={counts} onChange={pickFilter} />

      {filtered.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="calendar-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, rtlText, { color: colors.textMuted }]}>{t('booking.emptyFiltered')}</Text>
        </View>
      ) : null}

      {visible.map((booking) => {
        const phone = booking.profiles?.phone;
        const whatsapp = booking.profiles?.whatsapp || phone;
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
          yearLabel,
          booking.profiles?.student_id_number
            ? `${t('profile.studentId')} ${booking.profiles.student_id_number}`
            : '',
        ].filter(Boolean);
        const overlapConfirmed = hasConfirmedOverlap(booking, bookings);
        const overlapPending =
          booking.status === 'pending' && overlappingBookings(booking, bookings, ['pending']).length > 0;
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            personIcon={seekerIcon(role)}
            personLabel={personBits.join(' · ') || undefined}
            personAvatar={booking.profiles?.avatar_url}
            extra={extraName || undefined}
            details={details}
            extraIcon={seekerExtraIcon(role)}
            warning={
              booking.status === 'pending' && overlapConfirmed
                ? t('owner.overlapWarn')
                : booking.status === 'pending' && overlapPending
                  ? t('owner.overlapPending')
                  : undefined
            }
            note={
              booking.status === 'cancelled' && booking.cancel_reason
                ? t('booking.cancelledNote', { note: booking.cancel_reason })
                : undefined
            }
          >
            {booking.status === 'pending' ? (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button title={t('admin.approve')} pill onPress={() => updateStatus(booking, 'confirmed')} />
                </View>
                <View style={styles.flex}>
                  <Button
                    title={t('admin.reject')}
                    variant="danger"
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
              <Button title={t('booking.complete')} pill onPress={() => updateStatus(booking, 'completed')} />
            ) : null}
            <Button
              title={t(seekerMessageKey(role))}
              variant="secondary"
              pill
              loading={busyId === booking.id}
              onPress={() => void messageStudent(booking)}
            />
            {phone ? (
              <Button title={t('common.call')} variant="ghost" pill onPress={() => Linking.openURL(`tel:${phone}`)} />
            ) : null}
            {whatsapp ? (
              <Button
                title={t('profile.openWhatsapp')}
                variant="ghost"
                pill
                onPress={() => Linking.openURL(whatsappLink(whatsapp))}
              />
            ) : null}
          </BookingCard>
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
        onRequestClose={() => setRejecting(null)}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRejecting(null)} />
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
            <Button title={t('common.cancel')} variant="ghost" pill onPress={() => setRejecting(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
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
  flex: { flex: 1, minWidth: 0 },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: 24,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
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
