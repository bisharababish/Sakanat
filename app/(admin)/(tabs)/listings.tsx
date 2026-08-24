import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { listingBadgeTone } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, ListingStatus } from '@/src/types/database';

type Filter = 'all' | ListingStatus;

export default function AdminListings() {
  const { t } = useTranslation();
  const { rtlText, alignStart } = useLayout();
  const [listings, setListings] = useState<Apartment[]>([]);
  const [status, setStatus] = useState<Filter>('pending');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email)')
      .order('created_at', { ascending: false });
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

  const removeListing = (item: Apartment) => {
    Alert.alert(t('admin.deleteListing'), t('admin.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', item.id);
          if (error) Alert.alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const visible = useMemo(
    () => (status === 'all' ? listings : listings.filter((item) => item.status === status)),
    [listings, status],
  );

  const openListing = (id: string) => {
    router.push({ pathname: '/(admin)/apartment/[id]', params: { id } });
  };

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('tabs.listings')}</Text>
      <View style={[styles.chips, { justifyContent: alignStart }]}>
        {(['all', 'pending', 'approved', 'hidden', 'rejected'] as Filter[]).map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? t('common.all') : t(`status.${value}`)}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>
      {visible.length === 0 ? <EmptyState title={t('admin.noListings')} /> : null}
      {visible.map((item) => (
        <View key={item.id} style={styles.block}>
          <StatusBadge label={t(`status.${item.status}`)} tone={listingBadgeTone(item.status)} />
          {item.profiles?.full_name ? (
            <Text style={[styles.owner, rtlText]}>
              {t('admin.ownerName')}: {item.profiles.full_name}
            </Text>
          ) : null}
          <ListingCard apartment={item} university={item.universities} distanceKm={item.campus_distance_km} onPress={() => openListing(item.id)} />
          <View style={[styles.row, { justifyContent: alignStart }]}>
            {item.status !== 'approved' ? (
              <View style={styles.flex}>
                <Button title={t('admin.approve')} onPress={() => void setListingStatus(item.id, 'approved')} />
              </View>
            ) : null}
            {item.status !== 'rejected' ? (
              <View style={styles.flex}>
                <Button title={t('admin.reject')} variant="danger" onPress={() => void setListingStatus(item.id, 'rejected')} />
              </View>
            ) : null}
          </View>
          <Button title={t('admin.review')} variant="secondary" onPress={() => openListing(item.id)} />
          <Button title={t('admin.deleteListing')} variant="ghost" onPress={() => removeListing(item)} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  block: { gap: 8 },
  owner: { fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
