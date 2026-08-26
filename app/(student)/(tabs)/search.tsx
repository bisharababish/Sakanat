import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { listingDistanceKm, UNDER_ONE_KM } from '@/src/lib/distance';
import { localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import { isStudentReady } from '@/src/lib/studentProfile';
import { apartmentPath, requireAccount } from '@/src/lib/guest';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Apartment, GenderPolicy, University } from '@/src/types/database';

type GenderFilter = 'suitable' | 'all' | GenderPolicy;

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, textAlign, writingDirection } = useLayout();
  const { profile } = useAuth();
  const { cities, universities } = useCatalog();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cityId, setCityId] = useState(profile?.city_id ?? '');
  const [universityId, setUniversityId] = useState(profile?.university_id ?? '');
  const [maxPrice, setMaxPrice] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [sort, setSort] = useState<'price' | 'distance'>('price');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>(profile?.gender ? 'suitable' : 'all');
  const [savedIds, setSavedIds] = useState<string[]>([]);

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
    if (profile?.id) {
      try {
        setSavedIds(await loadSavedApartmentIds(profile.id));
      } catch {
        setSavedIds([]);
      }
    }
  }, [profile?.id]);

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
    const needle = query.trim().toLowerCase();
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
      .filter((item) => {
        if (!needle) return true;
        const haystack = [
          localizedTitle(item, i18n.language),
          localizedDescription(item, i18n.language),
          localizedName(item.cities, i18n.language),
          localizedName(item.universities, i18n.language),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
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
  }, [
    apartments,
    cityId,
    genderFilter,
    i18n.language,
    maxKm,
    maxPrice,
    profile?.gender,
    query,
    selectedUniversity,
    sort,
  ]);

  const defaultGender: GenderFilter = profile?.gender ? 'suitable' : 'all';
  const filtersOn = Boolean(
    query.trim() || cityId || universityId || maxPrice || maxKm || genderFilter !== defaultGender,
  );

  const clearFilters = () => {
    setQuery('');
    setCityId('');
    setUniversityId('');
    setMaxPrice('');
    setMaxKm('');
    setGenderFilter(profile?.gender ? 'suitable' : 'all');
    setSort('price');
  };

  const chipAlign = { justifyContent: isRtl ? ('flex-end' as const) : ('flex-start' as const) };

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={[styles.title, rtlText]}>{t('search.title')}</Text>
        <Text style={[styles.sub, rtlText]}>{t('search.subtitle')}</Text>
      </View>

      {!profile ? (
        <ProfileBanner icon="person-outline" text={t('guest.banner')} onPress={() => router.push('/(auth)/register')} />
      ) : !isStudentReady(profile) ? (
        <ProfileBanner
          icon="sparkles"
          text={t('profile.completeHint')}
          onPress={() => router.push('/(student)/(tabs)/profile')}
        />
      ) : null}

      <View style={[styles.searchBar, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Ionicons name="search" size={20} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { textAlign, writingDirection }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('search.clear')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.filterGrid, chipAlign]}>
        <View style={styles.filterCell}>
          <Select
            compact
            icon="location-outline"
            label={t('common.city')}
            value={cityId}
            placeholder={t('search.anyCity')}
            options={[
              { value: '', label: t('search.anyCity') },
              ...cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
            ]}
            onChange={setCity}
          />
        </View>
        <View style={styles.filterCell}>
          <SearchSelect
            compact
            icon="school-outline"
            label={t('common.university')}
            value={universityId}
            placeholder={t('search.anyUniversity')}
            options={[
              { value: '', label: t('search.anyUniversity') },
              ...cityUniversities.map((item) => ({ value: item.id, label: localizedName(item, i18n.language) })),
            ]}
            onChange={setUniversityId}
          />
        </View>
        <View style={styles.filterCell}>
          <Select
            compact
            icon="cash-outline"
            label={t('search.maxPrice')}
            value={maxPrice}
            placeholder={t('search.maxPrice')}
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
        </View>
        <View style={styles.filterCell}>
          <Select
            compact
            icon="navigate-outline"
            label={t('search.maxKm')}
            value={maxKm}
            placeholder={t('search.maxKm')}
            options={[
              { value: '', label: t('common.all') },
              { value: String(UNDER_ONE_KM), label: t('common.under1km') },
              { value: '1', label: `1 ${t('common.km')}` },
              { value: '2', label: `2 ${t('common.km')}` },
              { value: '3', label: `3 ${t('common.km')}` },
              { value: '5', label: `5 ${t('common.km')}` },
              { value: '8', label: `8 ${t('common.km')}` },
              { value: '10', label: `10 ${t('common.km')}` },
            ]}
            onChange={setMaxKm}
          />
        </View>
      </View>

      <View style={[styles.chipRow, chipAlign]}>
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
      <View style={[styles.chipRow, chipAlign]}>
        <Chip label={t('search.sortPrice')} selected={sort === 'price'} onPress={() => setSort('price')} />
        <Chip label={t('search.sortDistance')} selected={sort === 'distance'} onPress={() => setSort('distance')} />
      </View>

      <View style={[styles.metaRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={styles.count}>{loading ? t('common.loading') : t('search.results', { count: filtered.length })}</Text>
        {filtersOn ? (
          <Pressable onPress={clearFilters} hitSlop={8}>
            <Text style={styles.clear}>{t('search.clear')}</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && filtered.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState title={t('search.empty')} />
          {filtersOn ? <Button title={t('search.clear')} onPress={clearFilters} variant="secondary" pill /> : null}
        </View>
      ) : null}
      {filtered.map(({ item, distance }) => (
        <ListingCard
          key={item.id}
          apartment={item}
          university={(selectedUniversity ?? item.universities) as University | null}
          distanceKm={distance}
          saved={savedIds.includes(item.id)}
          onToggleSave={() => {
            if (!profile) {
              requireAccount();
              return;
            }
            const currently = savedIds.includes(item.id);
            setSavedIds((ids) => (currently ? ids.filter((id) => id !== item.id) : [...ids, item.id]));
            void toggleSavedApartment(profile.id, item.id, currently).then((next) => {
              setSavedIds((ids) => {
                const has = ids.includes(item.id);
                if (next && !has) return [...ids, item.id];
                if (!next && has) return ids.filter((id) => id !== item.id);
                return ids;
              });
            });
          }}
          onPress={() =>
            router.push({
              pathname: apartmentPath(Boolean(profile)),
              params: { id: item.id, universityId: universityId || '' },
            })
          }
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  title: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  sub: { color: colors.textMuted, fontSize: 14, fontFamily: 'Cairo_400Regular' },
  searchBar: {
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'Cairo_400Regular',
    paddingVertical: 12,
  },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  filterCell: { flexGrow: 1, flexBasis: '47%', minWidth: 148 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  metaRow: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { color: colors.textMuted, fontSize: 13, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  clear: { color: colors.primary, fontSize: 13, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  empty: { gap: spacing.md },
});
