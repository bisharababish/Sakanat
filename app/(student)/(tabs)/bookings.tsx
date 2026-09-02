import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BookingCard } from '@/components/booking/BookingCard';
import { StatusFilters } from '@/components/booking/StatusFilters';
import { Button } from '@/components/ui/Button';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { alert } from '@/src/lib/notice';
import { BOOKING_PAGE_SIZE, paginate } from '@/src/lib/page';
import { whatsappLink } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, Booking, BookingStatus } from '@/src/types/database';

type Filter = 'all' | BookingStatus;

export default function StudentBookings() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, apartments(*, cities(*)), profiles!owner_id(id, full_name, phone, whatsapp)')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  const cancel = (id: string) => {
    alert(t('booking.cancelRequest'), t('booking.confirmCancel'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const messageOwner = async (booking: Booking) => {
    if (!profile || !booking.apartments) return;
    setBusyId(booking.id);
    try {
      const conversationId = await openConversation(booking.apartments as Apartment, profile.id);
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
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

  return (
    <Screen>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.bookings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('booking.myBookings')}</Text>
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
          <Text style={[styles.emptyText, rtlText, { color: colors.textMuted }]}>
            {bookings.length === 0 ? t('booking.empty') : t('booking.emptyFiltered')}
          </Text>
          {bookings.length === 0 ? (
            <Button title={t('booking.findPlace')} onPress={() => router.push('/(student)/(tabs)/search')} pill />
          ) : null}
        </View>
      ) : null}

      {visible.map((booking) => {
        const phone = booking.profiles?.phone;
        const whatsapp = booking.profiles?.whatsapp || phone;
        return (
          <BookingCard
            key={booking.id}
            booking={booking}
            personIcon="home"
            personLabel={booking.profiles?.full_name ? `${t('listing.owner')}: ${booking.profiles.full_name}` : undefined}
            note={
              booking.status === 'cancelled' && booking.cancel_reason
                ? t('booking.cancelledNote', { note: booking.cancel_reason })
                : undefined
            }
          >
            {booking.apartment_id ? (
              <Button
                title={t('booking.viewListing')}
                variant="secondary"
                pill
                onPress={() =>
                  router.push({ pathname: '/(student)/apartment/[id]', params: { id: booking.apartment_id } })
                }
              />
            ) : null}
            <Button
              title={t('booking.messageOwner')}
              variant="ghost"
              pill
              loading={busyId === booking.id}
              onPress={() => void messageOwner(booking)}
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
            {(booking.payment_method === 'visa' || booking.payment_method === 'pay_now') &&
            booking.payment_status === 'unpaid' &&
            booking.status !== 'cancelled' ? (
              <Button title={t('booking.payNow')} pill onPress={() => payVisa(booking.id)} />
            ) : null}
            {booking.status === 'pending' ? (
              <Button title={t('booking.cancelRequest')} variant="danger" pill onPress={() => cancel(booking.id)} />
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
