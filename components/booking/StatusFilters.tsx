import { useTranslation } from 'react-i18next';

import { FilterPills } from '@/components/ui/FilterPills';
import { bookingStatusLabel } from '@/src/lib/format';
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

  return (
    <FilterPills
      compact
      value={value}
      onChange={onChange}
      items={FILTERS.map((item) => ({
        value: item,
        label: item === 'all' ? t('common.all') : bookingStatusLabel(item, t),
        count: counts[item],
      }))}
    />
  );
}
