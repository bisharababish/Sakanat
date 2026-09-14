import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useLayout } from '@/src/hooks/useLayout';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { useToday } from '@/src/hooks/useToday';
import { ageFromDob } from '@/src/lib/format';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Kind = 'birth' | 'booking' | 'expiry';
type Mode = 'days' | 'months' | 'years';

type Props = {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  kind?: Kind;
  compact?: boolean;
};

const WEEKDAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < start; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatDate(iso: string, lang: string) {
  const date = parseIso(iso);
  if (!date) return '';
  return date.toLocaleDateString(lang.startsWith('ar') ? 'ar' : 'en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function yearBounds(kind: Kind, now: Date) {
  if (kind === 'booking') {
    return { minYear: now.getFullYear(), maxYear: now.getFullYear() + 2 };
  }
  if (kind === 'expiry') {
    return { minYear: now.getFullYear() - 10, maxYear: now.getFullYear() + 25 };
  }
  return { minYear: now.getFullYear() - 80, maxYear: now.getFullYear() - 16 };
}

function defaultDate(kind: Kind, now: Date) {
  if (kind === 'booking') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  if (kind === 'expiry') return new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
  return new Date(2004, 0, 1);
}

function clampDay(year: number, month: number, day: number) {
  const max = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(day, 1), max);
}

export function DateField({ label, value, onChange, kind = 'birth', compact }: Props) {
  const { t, i18n } = useTranslation();
  const { rtlText, row, alignStart } = useLayout();
  const colors = useColors();
  const safe = useModalSafeArea();
  const today = useToday();
  const [open, setOpen] = useState(false);
  const edgeBack = useEdgeBack(open, () => setOpen(false));
  const [mode, setMode] = useState<Mode>('days');
  const now = new Date();
  const { minYear, maxYear } = yearBounds(kind, now);
  const fallback = defaultDate(kind, now);
  const [cursorYear, setCursorYear] = useState(() => (parseIso(value) ?? fallback).getFullYear());
  const [cursorMonth, setCursorMonth] = useState(() => (parseIso(value) ?? fallback).getMonth());
  const cells = useMemo(() => monthGrid(cursorYear, cursorMonth), [cursorYear, cursorMonth]);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) list.push(year);
    return list;
  }, [minYear, maxYear]);
  const lang = i18n.language;
  const arabic = lang.startsWith('ar');
  const locale = arabic ? 'ar' : 'en';
  const weekdays = arabic ? WEEKDAYS_AR : WEEKDAYS_EN;
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) =>
        new Date(2024, month, 1).toLocaleDateString(locale, { month: 'long' }),
      ),
    [locale],
  );
  const age = kind === 'birth' ? ageFromDob(value, today) : null;
  const display = value ? formatDate(value, lang) : '';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const openCalendar = () => {
    const selected = parseIso(value) ?? fallback;
    setCursorYear(selected.getFullYear());
    setCursorMonth(selected.getMonth());
    setMode('days');
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    const date = new Date(cursorYear, cursorMonth + delta, 1);
    const year = date.getFullYear();
    if (year < minYear || year > maxYear) return;
    setCursorYear(year);
    setCursorMonth(date.getMonth());
  };

  const pickYear = (year: number) => {
    setCursorYear(year);
    setMode('months');
  };

  const pickMonth = (month: number) => {
    setCursorMonth(month);
    setMode('days');
  };

  const pickDay = (day: number) => {
    const safeDay = clampDay(cursorYear, cursorMonth, day);
    const next = new Date(cursorYear, cursorMonth, safeDay);
    if (next.getFullYear() < minYear || next.getFullYear() > maxYear) return;
    if (kind === 'booking' && next < startOfToday) return;
    onChange(toIso(next));
    setOpen(false);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact, rtlText, { color: colors.text }]}>{label}</Text>
      <Pressable
        style={[
          styles.field,
          compact && styles.fieldCompact,
          row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={openCalendar}
      >
        <Ionicons name="calendar-outline" size={compact ? 16 : 20} color={colors.primary} />
        <Text
          style={[
            styles.value,
            compact && styles.valueCompact,
            rtlText,
            { color: value ? colors.text : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {display || t('profile.pickDate')}
        </Text>
        {age != null ? (
          <View style={[styles.ageChip, compact && styles.ageChipCompact, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.ageNum, compact && styles.ageNumCompact, { color: colors.primary }]}>{age}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={[
            styles.overlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: Math.max(safe.top, spacing.lg),
              paddingBottom: Math.max(safe.bottom, spacing.lg),
            },
          ]}
          {...edgeBack}
        >
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHead, { alignItems: alignStart }]}>
              <BackButton onPress={() => setOpen(false)} />
            </View>

            <View style={[styles.jumpRow, row]}>
              <Pressable
                onPress={() => setMode((current) => (current === 'years' ? 'days' : 'years'))}
                style={[
                  styles.jumpBtn,
                  {
                    backgroundColor: mode === 'years' ? colors.primarySoft : colors.surfaceMuted,
                    borderColor: mode === 'years' ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.jumpLabel, { color: colors.textMuted }]}>{t('profile.pickYear')}</Text>
                <View style={[styles.jumpValueRow, row]}>
                  <Text style={[styles.jumpValue, { color: colors.text }]}>{cursorYear}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.primary} />
                </View>
              </Pressable>

              <Pressable
                onPress={() => setMode((current) => (current === 'months' ? 'days' : 'months'))}
                style={[
                  styles.jumpBtn,
                  {
                    backgroundColor: mode === 'months' ? colors.primarySoft : colors.surfaceMuted,
                    borderColor: mode === 'months' ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.jumpLabel, { color: colors.textMuted }]}>{t('profile.pickMonth')}</Text>
                <View style={[styles.jumpValueRow, row]}>
                  <Text style={[styles.jumpValue, { color: colors.text }]} numberOfLines={1}>
                    {monthNames[cursorMonth]}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.primary} />
                </View>
              </Pressable>
            </View>

            {mode === 'years' ? (
              <FlatList
                data={years}
                keyExtractor={(year) => String(year)}
                numColumns={3}
                style={styles.yearList}
                contentContainerStyle={styles.yearListContent}
                columnWrapperStyle={styles.yearRow}
                renderItem={({ item: year }) => {
                  const on = cursorYear === year;
                  return (
                    <Pressable
                      onPress={() => pickYear(year)}
                      style={[
                        styles.yearCell,
                        {
                          backgroundColor: on ? colors.primary : colors.surface,
                          borderColor: on ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.yearText, { color: on ? colors.white : colors.text }]}>{year}</Text>
                    </Pressable>
                  );
                }}
              />
            ) : null}

            {mode === 'months' ? (
              <View style={styles.monthGrid}>
                {monthNames.map((name, month) => {
                  const on = cursorMonth === month;
                  return (
                    <Pressable
                      key={`${cursorYear}-${month}`}
                      onPress={() => pickMonth(month)}
                      style={[
                        styles.monthCell,
                        {
                          backgroundColor: on ? colors.primary : colors.surface,
                          borderColor: on ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.monthCellText, { color: on ? colors.white : colors.text }]} numberOfLines={1}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {mode === 'days' ? (
              <>
                <View style={[styles.nav, row]}>
                  <Pressable onPress={() => shiftMonth(-1)} hitSlop={12} style={styles.navBtn}>
                    <Text style={[styles.navText, { color: colors.primary }]}>‹</Text>
                  </Pressable>
                  <Text style={[styles.monthTitle, { color: colors.text }]}>
                    {monthNames[cursorMonth]} {cursorYear}
                  </Text>
                  <Pressable onPress={() => shiftMonth(1)} hitSlop={12} style={styles.navBtn}>
                    <Text style={[styles.navText, { color: colors.primary }]}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.week}>
                  {weekdays.map((day, index) => (
                    <Text key={`${day}-${index}`} style={[styles.weekday, { color: colors.textMuted }]}>
                      {day}
                    </Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((day, index) => {
                    const iso = day ? toIso(new Date(cursorYear, cursorMonth, day)) : '';
                    const on = Boolean(day && value === iso);
                    const date = day != null ? new Date(cursorYear, cursorMonth, day) : null;
                    const off = date != null && kind === 'booking' && date < startOfToday;
                    return (
                      <Pressable
                        key={`${cursorYear}-${cursorMonth}-${index}`}
                        style={[styles.day, on ? { backgroundColor: colors.primary } : null, off ? styles.dayOff : null]}
                        disabled={!day || off}
                        onPress={() => day && pickDay(day)}
                      >
                        <Text style={[styles.dayText, { color: on ? colors.white : colors.text }]}>{day ?? ''}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {kind === 'birth' && value && age != null ? (
              <View style={[styles.summary, row, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
                <Text style={[styles.summaryText, rtlText, { color: colors.text }]}>
                  {display} · {t('profile.yearsOld', { count: age })}
                </Text>
              </View>
            ) : null}
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, maxWidth: '100%' },
  wrapCompact: { gap: 4 },
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  labelCompact: { fontSize: 12 },
  field: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  fieldCompact: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    gap: 8,
    borderRadius: radius.sm,
  },
  value: { flex: 1, fontSize: 16, fontFamily: 'Cairo_400Regular' },
  valueCompact: { fontSize: 14 },
  ageChip: {
    minWidth: 36,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  ageChipCompact: {
    minWidth: 30,
    height: 26,
    paddingHorizontal: 8,
  },
  ageNum: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  ageNumCompact: { fontSize: 13 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: '90%',
  },
  sheetHead: { paddingBottom: 4 },
  jumpRow: { gap: 8 },
  jumpBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  jumpLabel: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  jumpValueRow: { alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  jumpValue: { flex: 1, fontSize: 16, fontFamily: 'Cairo_800ExtraBold' },
  nav: { alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 28, fontWeight: '700' },
  monthTitle: { fontWeight: '800', fontSize: 16, fontFamily: 'Cairo_800ExtraBold', textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 12, fontFamily: 'Cairo_700Bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.28%', minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  dayOff: { opacity: 0.35 },
  dayText: { fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  yearList: { maxHeight: 300 },
  yearListContent: { paddingVertical: 4, gap: 8 },
  yearRow: { gap: 8, marginBottom: 8 },
  yearCell: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: { fontSize: 16, fontFamily: 'Cairo_800ExtraBold' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: {
    width: '31%',
    flexGrow: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  monthCellText: { fontSize: 13, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  summary: {
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  summaryText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
});
