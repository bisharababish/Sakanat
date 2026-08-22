import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { listingDistanceKm } from '@/src/lib/distance';
import { localizedName } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment, University } from '@/src/types/database';

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign, row, lang } = useLayout();
  const { profile } = useAuth();
  const { cities, universities } = useCatalog();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityId, setCityId] = useState('');
  const [universityId, setUniversityId] = useState(profile?.university_id ?? '');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [sort, setSort] = useState<'price' | 'distance'>('price');

  useEffect(() => {
    supabase
      .from('apartments')
      .select('*, cities(*), universities(*)')
      .eq('status', 'approved')
      .order('price_month')
      .then(({ data }) => {
        setApartments((data as Apartment[]) ?? []);
        setLoading(false);
      });
  }, []);

  const selectedUniversity = useMemo(
    () => universities.find((item) => item.id === universityId) ?? null,
    [universities, universityId],
  );

  const filtered = useMemo(() => {
    const withDistance = apartments
      .filter((item) => !cityId || item.city_id === cityId)
      .map((item) => ({
        item,
        distance: listingDistanceKm(item, selectedUniversity),
      }))
      .filter((entry) => !maxPrice || entry.item.price_month <= Number(maxPrice))
      .filter((entry) => !maxKm || (entry.distance != null && entry.distance <= Number(maxKm)));

    withDistance.sort((a, b) => {
      if (sort === 'distance') {
        return (a.distance ?? 999) - (b.distance ?? 999);
      }
      return a.item.price_month - b.item.price_month;
    });
    return withDistance;
  }, [apartments, cityId, maxKm, maxPrice, selectedUniversity, sort]);

  return (
    <Screen>
      <Text style={[styles.brand, { textAlign }]}>{t('appName')}</Text>
      <Text style={[styles.title, { textAlign }]}>{t('search.title')}</Text>
      <Text style={[styles.sub, { textAlign }]}>{t('search.subtitle')}</Text>
      <Select
        label={t('common.city')}
        value={cityId}
        placeholder={t('search.anyCity')}
        options={[{ value: '', label: t('search.anyCity') }, ...cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) }))]}
        onChange={setCityId}
      />
      <Select
        label={t('common.university')}
        value={universityId}
        placeholder={t('search.anyUniversity')}
        options={[
          { value: '', label: t('search.anyUniversity') },
          ...universities.map((item) => ({ value: item.id, label: localizedName(item, i18n.language) })),
        ]}
        onChange={setUniversityId}
      />
      <Select
        label={t('search.maxPrice')}
        value={maxPrice}
        placeholder={t('common.all')}
        options={[
          { value: '', label: t('common.all') },
          { value: '500', label: '₪500' },
          { value: '700', label: '₪700' },
          { value: '900', label: '₪900' },
          { value: '1200', label: '₪1200' },
        ]}
        onChange={setMaxPrice}
      />
      <Select
        label={t('search.maxKm')}
        value={maxKm}
        placeholder={t('common.all')}
        options={[
          { value: '', label: t('common.all') },
          { value: '1', label: '1 km' },
          { value: '3', label: '3 km' },
          { value: '8', label: '8 km' },
          { value: '15', label: '15 km' },
        ]}
        onChange={setMaxKm}
      />
      <View style={[styles.row, row]}>
        <Chip label={t('search.sortPrice')} selected={sort === 'price'} onPress={() => setSort('price')} />
        <Chip label={t('search.sortDistance')} selected={sort === 'distance'} onPress={() => setSort('distance')} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && filtered.length === 0 ? <EmptyState title={t('search.empty')} /> : null}
      {filtered.map(({ item, distance }) => (
        <ListingCard
          key={item.id}
          apartment={item}
          university={selectedUniversity as University | null}
          distanceKm={distance}
          onPress={() =>
            router.push({
              pathname: '/(student)/apartment/[id]',
              params: { id: item.id, universityId: universityId || '' },
            })
          }
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  sub: { color: colors.textMuted, marginBottom: 4 },
  row: { flexWrap: 'wrap', gap: 8 },
});
