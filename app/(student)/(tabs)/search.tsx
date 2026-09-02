import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { listingDistanceKm, UNDER_ONE_KM } from '@/src/lib/distance';
import { localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import { isStudentReady } from '@/src/lib/studentProfile';
import { apartmentPath, openWelcome, requireAccount } from '@/src/lib/guest';
import { LISTING_PAGE_SIZE } from '@/src/lib/page';
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
  const { cities, universities, reload: reloadCatalog } = useCatalog();
  const isRenter = profile?.role === 'renter';
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cityId, setCityId] = useState(isRenter ? (profile?.city_id ?? '') : '');
  const [universityId, setUniversityId] = useState(isRenter ? '' : (profile?.university_id ?? ''));
  const [maxPrice, setMaxPrice] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [sort, setSort] = useState<'price' | 'distance'>(
    !isRenter && profile?.university_id ? 'distance' : 'price',
  );
  const [genderFilter, setGenderFilter] = useState<GenderFilter>(profile?.gender ? 'suitable' : 'all');
  const [roomsFilter, setRoomsFilter] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (isRenter) {
      setUniversityId('');
      if (profile?.city_id) setCityId((current) => current || profile.city_id || '');
    } else if (profile?.university_id) {
      setUniversityId((current) => current || profile.university_id || '');
      setSort((current) => (current === 'price' ? 'distance' : current));
    }
    if (profile?.gender) setGenderFilter((current) => (current === 'all' ? 'suitable' : current));
  }, [isRenter, profile?.city_id, profile?.gender, profile?.university_id]);

  const load = useCallback(async () => {
    reloadCatalog();
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
  }, [profile?.id, reloadCatalog]);

  const { refreshing, refresh } = useLiveReload(load, ['apartments', 'saved_apartments'], 'search');

  const selectedUniversity = useMemo(
    () => (isRenter ? null : universities.find((item) => item.id === universityId) ?? null),
    [isRenter, universities, universityId],
  );
  const distancePlace = selectedUniversity ? ('campus' as const) : ('city' as const);

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
          ...(isRenter ? [] : [localizedName(item.universities, i18n.language)]),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      })
      .map((item) => ({
        item,
        distance: listingDistanceKm(
          item,
          selectedUniversity,
          selectedUniversity ? null : item.cities,
        ),
      }))
      .filter((entry) => !maxPrice || entry.item.price_month <= Number(maxPrice))
      .filter((entry) => !maxKm || (entry.distance != null && entry.distance <= Number(maxKm)))
      .filter((entry) => {
        if (!roomsFilter) return true;
        if (roomsFilter === '4') return entry.item.rooms >= 4;
        return entry.item.rooms === Number(roomsFilter);
      });

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
    isRenter,
    maxKm,
    maxPrice,
    profile?.gender,
    query,
    roomsFilter,
    selectedUniversity,
    sort,
  ]);

  const paged = usePaged(
    filtered,
    LISTING_PAGE_SIZE,
    [query, cityId, universityId, maxPrice, maxKm, roomsFilter, genderFilter, sort].join('|'),
  );

  const defaultCityId = isRenter ? (profile?.city_id ?? '') : '';
  const defaultUniversityId = isRenter ? '' : (profile?.university_id ?? '');
  const defaultGender: GenderFilter = profile?.gender ? 'suitable' : 'all';
  const defaultSort: 'price' | 'distance' = !isRenter && defaultUniversityId ? 'distance' : 'price';
  const filtersOn = Boolean(
    query.trim() ||
      cityId !== defaultCityId ||
      universityId !== defaultUniversityId ||
      maxPrice ||
      maxKm ||
      roomsFilter ||
      genderFilter !== defaultGender ||
      sort !== defaultSort,
  );

  const clearFilters = () => {
    setQuery('');
    setCityId(defaultCityId);
    setUniversityId(defaultUniversityId);
    setMaxPrice('');
    setMaxKm('');
    setRoomsFilter('');
    setGenderFilter(defaultGender);
    setSort(defaultSort);
  };

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    const city = cities.find((item) => item.id === cityId);
    if (city) parts.push(localizedName(city, i18n.language));
    if (!isRenter && universityId) {
      const campus = universities.find((item) => item.id === universityId);
      if (campus) parts.push(localizedName(campus, i18n.language));
    }
    if (maxPrice) parts.push(`₪${maxPrice}`);
    if (maxKm) {
      parts.push(maxKm === String(UNDER_ONE_KM) ? t('common.under1km') : `${maxKm} ${t('common.km')}`);
    }
    if (roomsFilter) parts.push(roomsFilter === '4' ? t('search.roomsPlus') : roomsFilter);
    if (genderFilter === 'suitable') parts.push(t('search.suitable'));
    else if (genderFilter === 'female' || genderFilter === 'male') parts.push(t(`gender.${genderFilter}`));
    return parts.join(' · ');
  }, [
    cities,
    cityId,
    genderFilter,
    i18n.language,
    isRenter,
    maxKm,
    maxPrice,
    roomsFilter,
    t,
    universities,
    universityId,
  ]);

  const chipAlign = { justifyContent: isRtl ? ('flex-end' as const) : ('flex-start' as const) };
  const genderItems = [
    ...(profile?.gender ? [{ value: 'suitable' as const, label: t('search.suitable') }] : []),
    { value: 'all' as const, label: t('common.all') },
    { value: 'female' as const, label: t('gender.female') },
    { value: 'male' as const, label: t('gender.male') },
  ];

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <View style={styles.head}>
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.search')}</Text>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('search.title')}</Text>
        <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>
          {t(isRenter ? 'search.subtitleRenter' : 'search.subtitle')}
        </Text>
      </View>

      {!profile ? (
        <ProfileBanner icon="person-outline" text={t('guest.banner')} onPress={openWelcome} />
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
          placeholder={t(isRenter ? 'search.placeholderRenter' : 'search.placeholder')}
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
          <Pressable
            onPress={() => setFiltersOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={filtersOpen ? t('search.hideFilters') : t('search.showFilters')}
            style={styles.panelHeadCopy}
          >
            <Text style={[styles.panelTitle, { color: colors.text }]}>{t('search.filters')}</Text>
            {!filtersOpen && filterSummary ? (
              <Text style={[styles.panelSummary, rtlText, { color: colors.textMuted }]} numberOfLines={2}>
                {filterSummary}
              </Text>
            ) : null}
          </Pressable>
          <View style={[styles.panelHeadActions, row]}>
            {filtersOn ? (
              <Pressable onPress={clearFilters} hitSlop={8}>
                <Text style={[styles.clear, { color: colors.primary }]}>{t('search.clear')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setFiltersOpen((open) => !open)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={filtersOpen ? t('search.hideFilters') : t('search.showFilters')}
            >
              <Ionicons
                name={filtersOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
        {filtersOpen ? (
          <>
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
              {isRenter ? null : (
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
              )}
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
                  label={distancePlace === 'campus' ? t('search.maxKm') : t('search.maxKmCity')}
                  value={maxKm}
                  placeholder={distancePlace === 'campus' ? t('search.maxKm') : t('search.maxKmCity')}
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
            <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('search.rooms')}</Text>
            <FilterPills
              value={roomsFilter}
              onChange={setRoomsFilter}
              items={[
                { value: '', label: t('common.all') },
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: t('search.roomsPlus') },
              ]}
            />
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
          </>
        ) : null}
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
      {paged.slice.map(({ item, distance }) => (
        <ListingCard
          key={item.id}
          apartment={item}
          university={isRenter ? null : distancePlace === 'campus' ? (selectedUniversity ?? item.universities) as University | null : null}
          distanceKm={distance}
          distancePlace={distancePlace}
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
              params: isRenter
                ? { id: item.id, from: 'city' }
                : {
                    id: item.id,
                    universityId: universityId || '',
                    from: selectedUniversity ? 'campus' : 'city',
                  },
            })
          }
        />
      ))}
      {!loading && filtered.length > 0 ? (
        <Pager
          page={paged.page}
          pages={paged.pages}
          from={paged.from}
          to={paged.to}
          total={paged.total}
          pageSize={paged.pageSize}
          onPage={paged.setPage}
        />
      ) : null}
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
  panelHeadCopy: { flex: 1, minWidth: 0, gap: 2 },
  panelHeadActions: { alignItems: 'center', gap: 10, flexShrink: 0 },
  panelTitle: { fontSize: 16, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  panelSummary: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
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
