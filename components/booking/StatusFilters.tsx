import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FilterPills } from '@/components/ui/FilterPills';
import { useLayout } from '@/src/hooks/useLayout';
import { bookingStatusLabel } from '@/src/lib/format';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { BookingStatus } from '@/src/types/database';

export type BookingFilter = 'all' | BookingStatus;

const FILTERS: BookingFilter[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

export function StatusFilters({
  value,
  counts,
  onChange,
}: {
  value: BookingFilter;
  counts: Record<BookingFilter, number>;
  onChange: (next: BookingFilter) => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const label = value === 'all' ? t('common.all') : bookingStatusLabel(value, t);

  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
      <View style={[styles.head, row]}>
        <Pressable onPress={() => setOpen((next) => !next)} style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{t('booking.statusFilter')}</Text>
          {open ? null : (
            <Text style={[styles.summary, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
              {label} · {counts[value]}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => setOpen((next) => !next)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={open ? t('search.hideFilters') : t('search.showFilters')}
        >
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {open ? (
        <FilterPills
          value={value}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
          items={FILTERS.map((item) => ({
            value: item,
            label: item === 'all' ? t('common.all') : bookingStatusLabel(item, t),
            count: counts[item],
          }))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
    gap: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  head: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  summary: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
});
