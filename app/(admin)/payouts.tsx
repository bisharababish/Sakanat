import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { formatIls } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';

type OwnerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  gross: number;
  fee: number;
  net: number;
  unpaidFee: number;
  bookings: number;
};

type PayFilter = 'all' | 'owed' | 'clear';

export default function AdminPayouts() {
  const { t } = useTranslation();
  const { rtlText, row, lang } = useLayout();
  const colors = useColors();
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PayFilter>('owed');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: owners }, { data: bookings }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'owner'),
      supabase
        .from('bookings')
        .select('owner_id, rent_amount, commission_amount, payment_status, status')
        .in('status', ['confirmed', 'completed']),
    ]);
    const map = new Map<string, OwnerRow>();
    for (const owner of owners ?? []) {
      map.set(owner.id, {
        id: owner.id,
        full_name: owner.full_name,
        email: owner.email,
        phone: owner.phone,
        gross: 0,
        fee: 0,
        net: 0,
        unpaidFee: 0,
        bookings: 0,
      });
    }
    for (const booking of bookings ?? []) {
      const row = map.get(booking.owner_id);
      if (!row) continue;
      const rent = Number(booking.rent_amount) || 0;
      const fee = Number(booking.commission_amount) || 0;
      row.gross += rent;
      row.fee += fee;
      row.net += Math.max(0, rent - fee);
      row.bookings += 1;
      if (booking.payment_status !== 'paid') row.unpaidFee += fee;
    }
    setRows(Array.from(map.values()).sort((a, b) => b.unpaidFee - a.unpaidFee || b.fee - a.fee));
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['bookings', 'profiles'], 'admin-payouts');

  const visible = useMemo(() => {
    let next = rows;
    if (filter === 'owed') next = next.filter((item) => item.unpaidFee > 0);
    if (filter === 'clear') next = next.filter((item) => item.fee > 0 && item.unpaidFee <= 0);
    const needle = query.trim().toLowerCase();
    if (!needle) return next;
    return next.filter((item) =>
      [item.full_name, item.email, item.phone].filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }, [rows, filter, query]);

  const markOwnerPaid = (owner: OwnerRow) => {
    alert(t('admin.markOwnerPaid'), t('admin.confirmMarkOwnerPaid'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.markPaid'),
        onPress: async () => {
          setBusyId(owner.id);
          const { error } = await supabase
            .from('bookings')
            .update({ payment_status: 'paid' })
            .eq('owner_id', owner.id)
            .in('status', ['confirmed', 'completed'])
            .neq('payment_status', 'paid');
          setBusyId(null);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  return (
    <Screen back onRefresh={() => void refresh()} refreshing={refreshing}>
      <AdminPageHeader kicker={t('roles.admin')} title={t('admin.payoutsTitle')} hint={t('admin.payoutsHint')} />
      <Input compact label={t('admin.searchUsers')} value={query} onChangeText={setQuery} />
      <FilterPills
        compact
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'owed', label: t('admin.payoutsOwed') },
          { value: 'clear', label: t('admin.payoutsClear') },
          { value: 'all', label: t('common.all') },
        ]}
      />
      {visible.length === 0 ? <EmptyState title={t('admin.payoutsEmpty')} /> : null}
      {visible.map((owner) => (
        <Card key={owner.id} compact>
          <SectionHead compact icon="wallet-outline" title={owner.full_name || owner.email || '—'} />
          <Text style={[styles.meta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
            {owner.email}
          </Text>
          <View style={[styles.metrics, row]}>
            <Text style={[styles.metric, rtlText, { color: colors.text }]}>
              {t('admin.commission')}: {formatIls(owner.fee, lang)}
            </Text>
            <Text style={[styles.metric, rtlText, { color: owner.unpaidFee > 0 ? colors.warning : colors.success }]}>
              {t('admin.unpaid')}: {formatIls(owner.unpaidFee, lang)}
            </Text>
          </View>
          <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
            {t('admin.bookings')}: {owner.bookings} · {t('admin.ownerNet')}: {formatIls(owner.net, lang)}
          </Text>
          <View style={[styles.actions, row]}>
            <Button
              title={t('admin.editUser')}
              variant="secondary"
              pill
              onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: owner.id } })}
            />
            {owner.unpaidFee > 0 ? (
              <Button
                title={t('admin.markPaid')}
                pill
                loading={busyId === owner.id}
                onPress={() => markOwnerPaid(owner)}
              />
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  metrics: { flexWrap: 'wrap', gap: 10 },
  metric: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  actions: { flexWrap: 'wrap', gap: 8 },
});
