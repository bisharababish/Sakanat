import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { StatusFilters } from '@/components/booking/StatusFilters';
import { Button } from '@/components/ui/Button';
import { NoteModal } from '@/components/ui/NoteModal';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { majorLabel } from '@/src/data/majors';
import { ageLabel, formatIls, localizedName } from '@/src/lib/format';
import { seekerIcon, seekerRoleLabel } from '@/src/lib/seeker';
import { alert } from '@/src/lib/notice';
import { BOOKING_PAGE_SIZE, paginate } from '@/src/lib/page';
import { notifyUser } from '@/src/lib/push';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Booking, BookingStatus, PaymentStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function AdminBookings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row, lang } = useLayout();
  const colors = useColors();
  const { universities } = useCatalog();
  const today = useToday();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(0);
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select(
        '*, apartments(*, cities(*)), student:profiles!student_id(id, full_name, avatar_url, phone, email, whatsapp, gender, university_id, city_id, role, major, study_year, student_id_number, date_of_birth), owner:profiles!owner_id(id, full_name, phone, email)',
      )
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['bookings'], 'admin-bookings');

  const updateStatus = async (id: string, status: BookingStatus, cancelReason?: string | null) => {
    const booking = bookings.find((item) => item.id === id);
    const patch: { status: BookingStatus; cancel_reason?: string | null } = { status };
    if (status === 'cancelled') patch.cancel_reason = cancelReason?.trim() || null;
    const { error } = await supabase.from('bookings').update(patch).eq('id', id);
    if (error) alert(t('common.error'), error.message);
    else {
      if (status === 'confirmed' && booking?.student_id) {
        void notifyUser(booking.student_id, t('push.bookingApprovedTitle'), t('push.bookingApprovedBody'));
      }
      if (status === 'cancelled' && booking?.student_id) {
        void notifyUser(booking.student_id, t('push.bookingRejectedTitle'), t('push.bookingRejectedBody'));
      }
      setRejecting(null);
      setRejectNote('');
      void load();
    }
  };

  const updatePayment = async (id: string, payment_status: PaymentStatus) => {
    const { error } = await supabase.from('bookings').update({ payment_status }).eq('id', id);
    if (error) alert(t('common.error'), error.message);
    else void load();
  };

  const removeBooking = (id: string) => {
    alert(t('admin.deleteBooking'), t('admin.confirmDeleteBooking'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('bookings').delete().eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

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

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.bookings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.bookings')}</Text>
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
        const student = booking.student;
        const gender =
          student?.gender === 'male' ? t('profile.male') : student?.gender === 'female' ? t('profile.female') : '';
        const university = localizedName(
          universities.find((item) => item.id === student?.university_id),
          i18n.language,
        );
        const personBits = [
          student?.full_name,
          gender,
          ageLabel(student?.date_of_birth, t, today),
          seekerRoleLabel(student?.role, t),
          booking.owner?.full_name,
        ].filter(Boolean);
        const extraBits = [
          university,
          `${t('admin.commission')}: ${formatIls(Number(booking.commission_amount), lang)}`,
        ].filter(Boolean);
        const yearKey = student?.study_year;
        const yearLabel = yearKey && /^[1-6]$/.test(yearKey) ? t(`profile.year${yearKey}` as 'profile.year1') : '';
        const details = [
          student?.major ? majorLabel(student.major, i18n.language) : '',
          yearLabel,
          student?.student_id_number ? `${t('profile.studentId')} ${student.student_id_number}` : '',
        ].filter(Boolean);
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            personIcon={seekerIcon(student?.role)}
            personLabel={personBits.join(' · ') || undefined}
            personAvatar={student?.avatar_url}
            extra={extraBits.join(' · ')}
            details={details}
            note={
              booking.status === 'cancelled' && booking.cancel_reason
                ? t('booking.cancelledNote', { note: booking.cancel_reason })
                : undefined
            }
          >
            {booking.status === 'pending' ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button title={t('admin.approve')} pill onPress={() => void updateStatus(booking.id, 'confirmed')} />
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
              <Button title={t('booking.complete')} pill onPress={() => void updateStatus(booking.id, 'completed')} />
            ) : null}
            {booking.status === 'cancelled' ? (
              <Button
                title={t('admin.restoreBooking')}
                variant="secondary"
                pill
                onPress={() => void updateStatus(booking.id, 'pending')}
              />
            ) : null}
            {booking.status === 'completed' ? (
              <Button
                title={t('admin.restoreBooking')}
                variant="ghost"
                pill
                onPress={() => void updateStatus(booking.id, 'confirmed')}
              />
            ) : null}
            {booking.payment_status === 'unpaid' && booking.status !== 'cancelled' ? (
              <Button
                title={t('admin.markPaid')}
                variant="secondary"
                pill
                onPress={() => void updatePayment(booking.id, 'paid')}
              />
            ) : null}
            {booking.payment_status === 'paid' && booking.status !== 'cancelled' ? (
              <Button
                title={t('admin.markUnpaid')}
                variant="ghost"
                pill
                onPress={() => void updatePayment(booking.id, 'unpaid')}
              />
            ) : null}
            {booking.apartment_id ? (
              <Button
                title={t('booking.viewListing')}
                variant="ghost"
                pill
                onPress={() => router.push({ pathname: '/(admin)/apartment/[id]', params: { id: booking.apartment_id } })}
              />
            ) : null}
            {booking.student_id ? (
              <Button
                title={t('admin.editUser')}
                variant="ghost"
                pill
                onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: booking.student_id } })}
              />
            ) : null}
            <Button title={t('admin.deleteBooking')} variant="danger" pill onPress={() => removeBooking(booking.id)} />
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
      <NoteModal
        visible={Boolean(rejecting)}
        title={t('booking.rejectConfirm')}
        label={t('booking.rejectNote')}
        hint={t('booking.rejectNoteHint')}
        value={rejectNote}
        confirmTitle={t('admin.reject')}
        loading={busy}
        onChange={setRejectNote}
        onConfirm={() => {
          if (!rejecting) return;
          setBusy(true);
          void updateStatus(rejecting.id, 'cancelled', rejectNote).finally(() => setBusy(false));
        }}
        onClose={() => setRejecting(null)}
      />
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
  row: { flexDirection: 'row', gap: 8 },
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
});
