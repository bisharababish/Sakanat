import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useAuth } from '@/src/lib/auth';
import { paymentBucket, paymentI18nKey } from '@/src/lib/booking';
import { formatBookingDate, formatIls, localizedTitle } from '@/src/lib/format';
import { EARNINGS_PAGE_SIZE } from '@/src/lib/page';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Booking } from '@/src/types/database';
import type { Palette } from '@/src/theme/colors';

type Period = 'month' | 'all';

function isThisMonth(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function money(bookings: Booking[]) {
  const rent = bookings.reduce((sum, item) => sum + Number(item.rent_amount), 0);
  const fee = bookings.reduce((sum, item) => sum + Number(item.commission_amount), 0);
  return { rent, fee, keep: Math.max(0, rent - fee), count: bookings.length };
}

function lastSixMonths(lang: string) {
  const locale = lang.startsWith('ar') ? 'ar' : 'en';
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleDateString(locale, { month: 'short' }),
    };
  });
}

function monthKeep(bookings: Booking[], year: number, month: number) {
  return bookings
    .filter((item) => {
      const date = new Date(item.created_at);
      return date.getFullYear() === year && date.getMonth() === month;
    })
    .reduce((sum, item) => sum + Number(item.rent_amount) - Number(item.commission_amount), 0);
}

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export default function OwnerEarnings() {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, lang, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [percent, setPercent] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      void supabase
        .from('bookings')
        .select('*, apartments(title_ar, title_en), student:profiles!student_id(id, full_name)')
        .eq('owner_id', profile.id)
        .in('status', ['confirmed', 'completed'])
        .order('created_at', { ascending: false })
        .then(({ data }) => setBookings((data as Booking[]) ?? []));
      void supabase
        .from('app_settings')
        .select('commission_percent')
        .eq('id', 1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.commission_percent != null) setPercent(Number(data.commission_percent));
        });
    }, [profile]),
  );

  const monthBookings = useMemo(() => bookings.filter((item) => isThisMonth(item.created_at)), [bookings]);
  const month = useMemo(() => money(monthBookings), [monthBookings]);
  const all = useMemo(() => money(bookings), [bookings]);
  const shown = period === 'month' ? month : all;
  const list = period === 'month' ? monthBookings : bookings;
  const paged = usePaged(list, EARNINGS_PAGE_SIZE, period);
  const keepShare = shown.rent > 0 ? Math.round((shown.keep / shown.rent) * 100) : 0;
  const feeShare = 100 - keepShare;
  const paySplit = useMemo(() => {
    const next = {
      cash: { keep: 0, count: 0 },
      check: { keep: 0, count: 0 },
      visa: { keep: 0, count: 0 },
    };
    for (const item of list) {
      const bucket = paymentBucket(item.payment_method);
      next[bucket].keep += Math.max(0, Number(item.rent_amount) - Number(item.commission_amount));
      next[bucket].count += 1;
    }
    return next;
  }, [list]);
  const months = useMemo(() => lastSixMonths(i18n.language), [i18n.language]);
  const chart = useMemo(() => {
    const points = months.map((item) => ({
      ...item,
      value: monthKeep(bookings, item.year, item.month),
    }));
    const peak = Math.max(...points.map((item) => item.value), 1);
    return points.map((item) => ({ ...item, height: 10 + (item.value / peak) * 86 }));
  }, [bookings, months]);

  return (
    <Screen>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.earnings')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('owner.youKeep')}</Text>
        </View>
        {percent != null ? (
          <View style={[styles.feePill, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[styles.feePillText, { color: colors.primaryDark }]}>{percent}%</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, row]}>
        {(['month', 'all'] as Period[]).map((value) => {
          const on = period === value;
          return (
            <Pressable
              key={value}
              onPress={() => setPeriod(value)}
              style={[styles.segmentBtn, on && { backgroundColor: colors.surface, shadowColor: colors.text }]}
            >
              <Text style={[styles.segmentLabel, { color: on ? colors.primary : colors.textMuted }]}>
                {value === 'month' ? t('owner.thisMonth') : t('owner.allTime')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.hero, { backgroundColor: colors.primary, shadowColor: colors.text }]}>
        <View style={[styles.orb, styles.orbOne]} />
        <View style={[styles.orb, styles.orbTwo]} />
        <View style={[styles.heroTop, row]}>
          <View style={styles.wallet}>
            <Ionicons name="wallet" size={18} color={colors.primary} />
          </View>
          <Text style={styles.heroCaption}>
            {period === 'month' ? t('owner.thisMonthCount', { count: shown.count }) : t('owner.allTimeCount', { count: shown.count })}
          </Text>
        </View>
        <Text style={[styles.heroValue, rtlText]}>{formatIls(shown.keep, lang)}</Text>
        <Text style={[styles.heroShare, rtlText]}>{t('owner.shareKeep', { percent: keepShare })}</Text>
        <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <View style={[styles.trackKeep, { flex: Math.max(keepShare, 1), backgroundColor: colors.accent }]} />
          <View style={[styles.trackFee, { flex: Math.max(feeShare, 1), backgroundColor: 'rgba(255,255,255,0.28)' }]} />
        </View>
        <View style={[styles.legend, row]}>
          <LegendDot color={colors.accent} label={t('owner.youKeep')} />
          <LegendDot color="rgba(255,255,255,0.45)" label={t('owner.platformFee')} />
        </View>
      </View>

      <View style={[styles.metrics, row]}>
        <Metric
          colors={colors}
          icon="home-outline"
          label={t('owner.rentCollected')}
          value={formatIls(shown.rent, lang)}
          rtlText={rtlText}
        />
        <Metric
          colors={colors}
          icon="cut-outline"
          label={t('owner.platformFee')}
          value={formatIls(shown.fee, lang)}
          rtlText={rtlText}
          warn
        />
        <Metric
          colors={colors}
          icon="calendar-outline"
          label={t('owner.bookingsCount')}
          value={String(shown.count)}
          rtlText={rtlText}
        />
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
        <Text style={[styles.panelTitle, rtlText, { color: colors.text }]}>{t('owner.paySplit')}</Text>
        <View style={styles.splitList}>
          {(['cash', 'check', 'visa'] as const).map((method, index) => (
            <View
              key={method}
              style={[
                styles.splitRow,
                row,
                index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null,
              ]}
            >
              <View>
                <Text style={[styles.splitLabel, rtlText, { color: colors.text }]}>{t(`payment.${method}`)}</Text>
                <Text style={[styles.splitMeta, rtlText, { color: colors.textMuted }]}>
                  {t('owner.bookingsCount')}: {paySplit[method].count}
                </Text>
              </View>
              <Text style={[styles.splitValue, { color: colors.primary }]}>
                {formatIls(paySplit[method].keep, lang)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.splitHint, rtlText, { color: colors.textMuted }]}>{t('owner.payoutNote')}</Text>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
        <Text style={[styles.panelTitle, rtlText, { color: colors.text }]}>{t('owner.lastMonths')}</Text>
        <View style={styles.chart}>
          {chart.map((item) => (
            <View key={item.key} style={styles.col}>
              <View style={[styles.colTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.colFill,
                    {
                      height: item.height,
                      backgroundColor: item.value > 0 ? colors.primary : colors.border,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.colLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[styles.section, rtlText, { color: colors.text }]}>{t('owner.earningBookings')}</Text>
      {list.length === 0 ? (
        <EmptyState title={t('owner.noEarnings')} />
      ) : (
      <View style={[styles.ledger, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
        {paged.slice.map((booking, index) => {
          const rent = Number(booking.rent_amount);
          const fee = Number(booking.commission_amount);
          const keep = Math.max(0, rent - fee);
          const student = booking.student?.full_name;
          const people = booking.occupants ?? 1;
          const keepPct = rent > 0 ? Math.max(8, Math.round((keep / rent) * 100)) : 0;
          return (
            <View
              key={booking.id}
              style={[
                styles.row,
                row,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.initials, { color: colors.primary }]}>{initials(student)}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, rtlText, { color: colors.text }]} numberOfLines={1}>
                  {localizedTitle(booking.apartments, i18n.language)}
                </Text>
                <Text style={[styles.rowMeta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
                  {student ? `${student} · ` : ''}
                  {formatBookingDate(booking.start_date, i18n.language)}
                  {' · '}
                  {people === 1 ? t('booking.onePerson') : t('booking.people', { count: people })}
                  {' · '}
                  {t(paymentI18nKey(booking.payment_method))}
                </Text>
                <View style={[styles.mini, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.miniKeep, { width: `${keepPct}%`, backgroundColor: colors.primary }]} />
                </View>
              </View>
              <View style={styles.rowCash}>
                <Text style={[styles.rowKeep, { color: colors.primary }]}>{formatIls(keep, lang)}</Text>
                <Text style={[styles.rowFee, { color: colors.textMuted }]}>−{formatIls(fee, lang)}</Text>
              </View>
            </View>
          );
        })}
      </View>
      )}
      {list.length > 0 ? (
        <Pager
          page={paged.page}
          pages={paged.pages}
          from={paged.from}
          to={paged.to}
          total={paged.total}
          pageSize={paged.pageSize}
          onPage={paged.setPage}
        />
      ) : null}
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.dotLabel}>{label}</Text>
    </View>
  );
}

function Metric({
  colors,
  icon,
  label,
  value,
  rtlText,
  warn,
}: {
  colors: Palette;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  rtlText: object;
  warn?: boolean;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: warn ? colors.dangerSoft : colors.primarySoft }]}>
        <Ionicons name={icon} size={16} color={warn ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.metricLabel, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.metricValue, rtlText, { color: warn ? colors.danger : colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', letterSpacing: 0.6 },
  title: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  feePill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  feePillText: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  segment: {
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: 10,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  segmentLabel: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hero: {
    borderRadius: 32,
    padding: spacing.lg,
    overflow: 'hidden',
    gap: 8,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 6,
  },
  orb: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
  },
  orbOne: { width: 160, height: 160, top: -50, right: -30 },
  orbTwo: { width: 90, height: 90, bottom: -28, left: -10 },
  heroTop: { alignItems: 'center', gap: 10 },
  wallet: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCaption: { color: 'rgba(255,255,255,0.78)', fontFamily: 'Cairo_400Regular', fontSize: 13, flex: 1 },
  heroValue: { color: '#fff', fontSize: 36, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  heroShare: { color: 'rgba(255,255,255,0.82)', fontFamily: 'Cairo_700Bold', fontSize: 13, marginTop: -4 },
  track: { height: 10, borderRadius: 999, overflow: 'hidden', flexDirection: 'row' },
  trackKeep: { height: '100%' },
  trackFee: { height: '100%' },
  legend: { gap: 16, marginTop: 2 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotLabel: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  metrics: { gap: 8 },
  metric: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  metricValue: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  splitList: { gap: 0 },
  splitRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  splitLabel: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  splitMeta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  splitValue: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  splitHint: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular', marginTop: 8 },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
    gap: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  panelTitle: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  chart: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 128,
  },
  col: { flex: 1, alignItems: 'center', gap: 8 },
  colTrack: {
    width: '100%',
    maxWidth: 28,
    height: 100,
    borderRadius: 14,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  colFill: { width: '100%', borderRadius: 14 },
  colLabel: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  section: { fontSize: 18, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginTop: 4 },
  ledger: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  rowMeta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  mini: { height: 5, borderRadius: 999, overflow: 'hidden' },
  miniKeep: { height: '100%', borderRadius: 999 },
  rowCash: { alignItems: 'flex-end', gap: 2 },
  rowKeep: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  rowFee: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
});
