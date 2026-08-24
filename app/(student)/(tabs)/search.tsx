import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { Apartment, GenderPolicy, University } from '@/src/types/database';

type GenderFilter = 'suitable' | 'all' | GenderPolicy;

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart } = useLayout();
  const { profile } = useAuth();
  const { cities, universities } = useCatalog();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityId, setCityId] = useState(profile?.city_id ?? '');
  const [universityId, setUniversityId] = useState(profile?.university_id ?? '');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [sort, setSort] = useState<'price' | 'distance'>('price');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>(profile?.gender ? 'suitable' : 'all');

  useEffect(() => {
    if (profile?.city_id) setCityId((current) => current || profile.city_id || '');
    if (profile?.university_id) setUniversityId((current) => current || profile.university_id || '');
    if (profile?.gender) setGenderFilter((current) => (current === 'all' ? 'suitable' : current));
  }, [profile?.city_id, profile?.gender, profile?.university_id]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*)')
      .eq('status', 'approved')
      .order('price_month');
    setApartments((data as Apartment[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const cityUniversities = useMemo(
    () => universities.filter((item) => !cityId || item.city_id === cityId),
    [cityId, universities],
  );

  const selectedUniversity = useMemo(
    () => universities.find((item) => item.id === universityId) ?? null,
    [universities, universityId],
  );

  const setCity = (next: string) => {
    setCityId(next);
    if (next && universityId) {
      const stillValid = universities.some((item) => item.id === universityId && item.city_id === next);
      if (!stillValid) setUniversityId('');
    }
  };

  const filtered = useMemo(() => {
    const withDistance = apartments
      .filter((item) => !cityId || item.city_id === cityId)
      .filter((item) => {
        if (genderFilter === 'all') return true;
        if (genderFilter === 'suitable') {
          if (!profile?.gender) return true;
          return item.gender_policy === 'any' || item.gender_policy === profile.gender;
        }
        return item.gender_policy === genderFilter;
      })
      .map((item) => ({
        item,
        distance: listingDistanceKm(item, selectedUniversity),
      }))
      .filter((entry) => !maxPrice || entry.item.price_month <= Number(maxPrice))
      .filter((entry) => !maxKm || (entry.distance != null && entry.distance <= Number(maxKm)));

    withDistance.sort((a, b) => {
      if (sort === 'distance') return (a.distance ?? 999) - (b.distance ?? 999);
      return a.item.price_month - b.item.price_month;
    });
    return withDistance;
  }, [apartments, cityId, genderFilter, maxKm, maxPrice, profile?.gender, selectedUniversity, sort]);

  return (
    <Screen>
      <Text style={[styles.brand, rtlText]}>{t('appName')}</Text>
      <Text style={[styles.title, rtlText]}>{t('search.title')}</Text>
      <Text style={[styles.sub, rtlText]}>{t('search.subtitle')}</Text>
      <Select
        label={t('common.city')}
        value={cityId}
        placeholder={t('search.anyCity')}
        options={[
          { value: '', label: t('search.anyCity') },
          ...cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
        ]}
        onChange={setCity}
      />
      <Select
        label={t('common.university')}
        value={universityId}
        placeholder={t('search.anyUniversity')}
        options={[
          { value: '', label: t('search.anyUniversity') },
          ...cityUniversities.map((item) => ({ value: item.id, label: localizedName(item, i18n.language) })),
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
          { value: '1500', label: '₪1500' },
          { value: '2000', label: '₪2000' },
        ]}
        onChange={setMaxPrice}
      />
      <Select
        label={t('search.maxKm')}
        value={maxKm}
        placeholder={t('common.all')}
        options={[
          { value: '', label: t('common.all') },
          { value: '1', label: `1 ${t('common.km')}` },
          { value: '3', label: `3 ${t('common.km')}` },
          { value: '8', label: `8 ${t('common.km')}` },
          { value: '15', label: `15 ${t('common.km')}` },
        ]}
        onChange={setMaxKm}
      />
      <Text style={[styles.label, rtlText]}>{t('search.whoFor')}</Text>
      <View style={[styles.chipRow, { justifyContent: alignStart }]}>
        {profile?.gender ? (
          <Chip
            label={t('search.suitable')}
            selected={genderFilter === 'suitable'}
            onPress={() => setGenderFilter('suitable')}
          />
        ) : null}
        <Chip label={t('common.all')} selected={genderFilter === 'all'} onPress={() => setGenderFilter('all')} />
        <Chip
          label={t('gender.female')}
          selected={genderFilter === 'female'}
          onPress={() => setGenderFilter('female')}
        />
        <Chip label={t('gender.male')} selected={genderFilter === 'male'} onPress={() => setGenderFilter('male')} />
      </View>
      <View style={[styles.chipRow, { justifyContent: alignStart }]}>
        <Chip label={t('search.sortPrice')} selected={sort === 'price'} onPress={() => setSort('price')} />
        <Chip label={t('search.sortDistance')} selected={sort === 'distance'} onPress={() => setSort('distance')} />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && filtered.length === 0 ? <EmptyState title={t('search.empty')} /> : null}
      {filtered.map(({ item, distance }) => (
        <ListingCard
          key={item.id}
          apartment={item}
          university={(selectedUniversity ?? item.universities) as University | null}
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
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
