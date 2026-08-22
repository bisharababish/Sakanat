import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, ListingStatus } from '@/src/types/database';

export default function AdminListings() {
  const { t, i18n } = useTranslation();
  const { textAlign, row } = useLayout();
  const [listings, setListings] = useState<Apartment[]>([]);
  const [status, setStatus] = useState<ListingStatus | 'all'>('pending');

  const load = useCallback(async () => {
    const { data } = await supabase.from('apartments').select('*, cities(*), universities(*)').order('created_at', { ascending: false });
    setListings((data as Apartment[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setListingStatus = async (id: string, next: ListingStatus) => {
    const { error } = await supabase.from('apartments').update({ status: next }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  const visible = listings.filter((item) => status === 'all' || item.status === status);

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('tabs.listings')}</Text>
      <View style={[styles.row, row]}>
        <Chip label={t('status.pending')} selected={status === 'pending'} onPress={() => setStatus('pending')} />
        <Chip label={t('status.approved')} selected={status === 'approved'} onPress={() => setStatus('approved')} />
        <Chip label={t('common.all')} selected={status === 'all'} onPress={() => setStatus('all')} />
      </View>
      {visible.length === 0 ? <EmptyState title={t('admin.noPending')} /> : null}
      {visible.map((item) => (
        <View key={item.id} style={styles.block}>
          <Text style={[styles.name, { textAlign }]}>{localizedTitle(item, i18n.language)}</Text>
          <StatusBadge
            label={t(`status.${item.status}`)}
            tone={item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'}
          />
          <ListingCard apartment={item} university={item.universities} distanceKm={item.campus_distance_km} onPress={() => undefined} />
          {item.status === 'pending' ? (
            <View style={[styles.row, row]}>
              <View style={styles.flex}>
                <Button title={t('admin.approve')} onPress={() => setListingStatus(item.id, 'approved')} />
              </View>
              <View style={styles.flex}>
                <Button title={t('admin.reject')} variant="danger" onPress={() => setListingStatus(item.id, 'rejected')} />
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  row: { flexWrap: 'wrap', gap: 8 },
  block: { gap: 8 },
  name: { fontWeight: '800', color: colors.text, fontSize: 16 },
  flex: { flex: 1 },
});
