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
import { useAuth } from '@/src/lib/auth';
import { listingBadgeTone } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, ListingStatus } from '@/src/types/database';

type Filter = 'all' | ListingStatus;

export default function OwnerListings() {
  const { t } = useTranslation();
  const { rtlText, alignStart } = useLayout();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Apartment[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*)')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });
    setListings((data as Apartment[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(
    () => (filter === 'all' ? listings : listings.filter((item) => item.status === filter)),
    [filter, listings],
  );

  const removeListing = (id: string) => {
    Alert.alert(t('owner.deleteListing'), t('owner.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', id);
          if (error) Alert.alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const hideListing = (id: string) => {
    Alert.alert(t('owner.hideListing'), t('owner.confirmHide'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.hideListing'),
        onPress: async () => {
          const { error } = await supabase.from('apartments').update({ status: 'hidden' }).eq('id', id);
          if (error) Alert.alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const unhideListing = async (id: string) => {
    const { error } = await supabase.from('apartments').update({ status: 'approved' }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('tabs.listings')}</Text>
      {profile?.owner_status === 'pending' ? (
        <Text style={[styles.warn, rtlText]}>{t('auth.ownerPending')}</Text>
      ) : null}
      {profile?.owner_status === 'rejected' ? (
        <Text style={[styles.warn, rtlText]}>{t('admin.ownerSuspended')}</Text>
      ) : null}
      <Button title={t('owner.addListing')} onPress={() => router.push('/(owner)/listing/new')} />
      <View style={[styles.chips, { justifyContent: alignStart }]}>
        {(['all', 'pending', 'approved', 'hidden', 'rejected'] as Filter[]).map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? t('common.all') : t(`status.${value}`)}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>
      {visible.length === 0 ? <EmptyState title={t('owner.empty')} /> : null}
      {visible.map((item) => (
        <View key={item.id} style={styles.block}>
          <StatusBadge label={t(`status.${item.status}`)} tone={listingBadgeTone(item.status)} />
          <ListingCard
            apartment={item}
            university={item.universities}
            distanceKm={item.campus_distance_km}
            onPress={() => router.push({ pathname: '/(owner)/listing/[id]', params: { id: item.id } })}
          />
          {item.status === 'approved' ? (
            <Button title={t('owner.hideListing')} variant="secondary" onPress={() => hideListing(item.id)} />
          ) : null}
          {item.status === 'hidden' ? (
            <Button title={t('owner.unhideListing')} variant="secondary" onPress={() => void unhideListing(item.id)} />
          ) : null}
          <Button title={t('owner.deleteListing')} variant="ghost" onPress={() => removeListing(item.id)} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  warn: { color: colors.warning, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  block: { gap: 8 },
});
