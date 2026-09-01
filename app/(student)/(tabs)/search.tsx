import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
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
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, GenderPolicy, University } from '@/src/types/database';

type GenderFilter = 'suitable' | 'all' | GenderPolicy;

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
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

  const selectedUniversity = useMemo(
    () => universities.find((item) => item.id === universityId) ?? null,
    [universities, universityId],
  );

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
  const genderItems = [
    ...(profile?.gender ? [{ value: 'suitable' as const, label: t('search.suitable') }] : []),
    { value: 'all' as const, label: t('common.all') },
    { value: 'female' as const, label: t('gender.female') },
    { value: 'male' as const, label: t('gender.male') },
  ];

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.search')}</Text>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('search.title')}</Text>
        <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>{t('search.subtitle')}</Text>
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

      <View
        style={[
          styles.searchBar,
          row,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
        ]}
      >
        <Ionicons name="search" size={20} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { textAlign, writingDirection, color: colors.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('search.clear')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
        <View style={[styles.panelHead, row]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>{t('search.filters')}</Text>
          {filtersOn ? (
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={[styles.clear, { color: colors.primary }]}>{t('search.clear')}</Text>
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
              onChange={setCityId}
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
                ...universities.map((item) => ({
                  value: item.id,
                  label: item.cities
                    ? `${localizedName(item, i18n.language)} — ${localizedName(item.cities, i18n.language)}`
                    : localizedName(item, i18n.language),
                })),
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
        <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('search.whoFor')}</Text>
        <FilterPills value={genderFilter} onChange={setGenderFilter} items={genderItems} />
        <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('search.sort')}</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, row]}>
          {(['price', 'distance'] as const).map((value) => {
            const on = sort === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSort(value)}
                style={[styles.segmentBtn, on && { backgroundColor: colors.surface, shadowColor: colors.text }]}
              >
                <Text style={[styles.segmentLabel, { color: on ? colors.primary : colors.textMuted }]}>
                  {value === 'price' ? t('search.sortPrice') : t('search.sortDistance')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.metaRow, row]}>
        <View style={[styles.countPill, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={[styles.count, { color: colors.primaryDark }]}>
            {loading ? t('common.loading') : t('search.results', { count: filtered.length })}
          </Text>
        </View>
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
  head: { gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  searchBar: {
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
    paddingVertical: 12,
  },
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
  panelHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelTitle: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  panelLabel: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  filterCell: { flexGrow: 1, flexBasis: '47%', minWidth: 148 },
  segment: {
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: 10,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  segmentLabel: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  metaRow: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  countPill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  count: { fontSize: 13, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  clear: { fontSize: 13, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  empty: { gap: spacing.md },
});
