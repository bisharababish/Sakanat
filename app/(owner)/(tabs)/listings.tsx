import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment } from '@/src/types/database';

export default function OwnerListings() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Apartment[]>([]);

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

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('tabs.listings')}</Text>
      {profile?.owner_status === 'pending' ? (
        <Text style={[styles.warn, { textAlign }]}>{t('auth.ownerPending')}</Text>
      ) : null}
      <Button title={t('owner.addListing')} onPress={() => router.push('/(owner)/listing/new')} />
      {listings.length === 0 ? <EmptyState title={t('owner.empty')} /> : null}
      {listings.map((item) => (
        <View key={item.id} style={{ gap: 8 }}>
          <StatusBadge
            label={t(`status.${item.status}`)}
            tone={item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'}
          />
          <ListingCard
            apartment={item}
            university={item.universities}
            distanceKm={item.campus_distance_km}
            onPress={() => router.push({ pathname: '/(owner)/listing/[id]', params: { id: item.id } })}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  warn: { color: colors.warning, lineHeight: 22 },
});
