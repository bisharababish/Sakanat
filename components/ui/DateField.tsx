import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  kind?: 'birth' | 'booking';
};

const WEEKDAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

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

export function DateField({ label, value, onChange, kind = 'birth' }: Props) {
  const { t, i18n } = useTranslation();
  const { rtlText, row, alignStart } = useLayout();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const minYear = kind === 'booking' ? now.getFullYear() : 1980;
  const maxYear = kind === 'booking' ? now.getFullYear() + 2 : now.getFullYear() - 16;
  const fallback =
    kind === 'booking'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)
      : new Date(2004, 0, 1);
  const selected = parseIso(value) ?? fallback;
  const [cursor, setCursor] = useState(selected);
  const cells = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const title = cursor.toLocaleDateString(i18n.language.startsWith('ar') ? 'ar' : 'en', {
    month: 'long',
    year: 'numeric',
  });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const openCalendar = () => {
    setCursor(parseIso(value) ?? fallback);
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    const year = next.getFullYear();
    if (year < minYear || year > maxYear) return;
    setCursor(next);
  };

  const pickDay = (day: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    if (next.getFullYear() < minYear || next.getFullYear() > maxYear) return;
    if (kind === 'booking' && next < startOfToday) return;
    onChange(toIso(next));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, rtlText, { color: colors.text }]}>{label}</Text>
      <Pressable
        style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={openCalendar}
      >
        <Text style={[styles.value, rtlText, { color: value ? colors.text : colors.textMuted }]}>
          {value || t('profile.pickDate')}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHead, { alignItems: alignStart }]}>
              <BackButton onPress={() => setOpen(false)} />
            </View>
            <View style={[styles.nav, row]}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={12} style={styles.navBtn}>
                <Text style={[styles.navText, { color: colors.primary }]}>‹</Text>
              </Pressable>
              <Text style={[styles.month, { color: colors.text }]}>{title}</Text>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={12} style={styles.navBtn}>
                <Text style={[styles.navText, { color: colors.primary }]}>›</Text>
              </Pressable>
            </View>
            <View style={styles.week}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={[styles.weekday, { color: colors.textMuted }]}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((day, index) => {
                const iso = day ? toIso(new Date(cursor.getFullYear(), cursor.getMonth(), day)) : '';
                const on = Boolean(day && value === iso);
                const off =
                  Boolean(day) &&
                  kind === 'booking' &&
                  new Date(cursor.getFullYear(), cursor.getMonth(), day) < startOfToday;
                return (
                  <Pressable
                    key={`${cursor.getMonth()}-${index}`}
                    style={[styles.day, on ? { backgroundColor: colors.primary } : null, off ? styles.dayOff : null]}
                    disabled={!day || off}
                    onPress={() => day && pickDay(day)}
                  >
                    <Text style={[styles.dayText, { color: on ? colors.white : colors.text }]}>{day ?? ''}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontWeight: '700', fontSize: 14 },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  value: { fontSize: 16 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sheetHead: { paddingBottom: 4 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 28, fontWeight: '700' },
  month: { fontWeight: '800', fontSize: 16 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.28%', minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  dayOff: { opacity: 0.35 },
  dayText: { fontWeight: '700' },
});
