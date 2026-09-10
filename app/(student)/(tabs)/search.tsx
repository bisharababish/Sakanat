import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
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
import { UNDER_ONE_KM, listingDistanceKm } from '@/src/lib/distance';
import { localizedName } from '@/src/lib/format';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import {
  loadSearchAlertPrefs,
  loadSeenListingIds,
  saveSearchAlertPrefs,
  saveSeenListingIds,
} from '@/src/lib/searchAlerts';
import { fetchApprovedListings, refineListings } from '@/src/lib/searchListings';
import { isStudentReady } from '@/src/lib/studentProfile';
import { apartmentPath, openWelcome, requireAccount } from '@/src/lib/guest';
import { LISTING_PAGE_SIZE } from '@/src/lib/page';
import { alert } from '@/src/lib/notice';
import { trackEvent } from '@/src/lib/analytics';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import { AMENITIES, type Amenity, type Apartment, type GenderPolicy, type University } from '@/src/types/database';

type GenderFilter = 'suitable' | 'all' | GenderPolicy;
type SortMode = 'price' | 'distance' | 'rating';

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
  const [sort, setSort] = useState<SortMode>(!isRenter && profile?.university_id ? 'distance' : 'price');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>(profile?.gender ? 'suitable' : 'all');
  const [roomsFilter, setRoomsFilter] = useState('');
  const [amenityFilter, setAmenityFilter] = useState<Amenity[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [alertSummary, setAlertSummary] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    void loadSearchAlertPrefs().then((prefs) => {
      setAlertOn(Boolean(prefs.enabled));
      const bits = [
        prefs.universityId ? 'uni' : '',
        prefs.cityId ? 'city' : '',
        prefs.maxPrice != null ? `₪${prefs.maxPrice}` : '',
        prefs.maxKm != null ? `${prefs.maxKm}km` : '',
      ].filter(Boolean);
      setAlertSummary(bits.join(' · '));
    });
  }, []);

  useEffect(() => {
    if (isRenter) {
      setUniversityId('');
      if (profile?.city_id) setCityId((current) => current || profile.city_id || '');
    } else if (profile?.university_id) {
      setUniversityId((current) => current || profile.university_id || '');
      setSort((current) => (current === 'price' ? 'distance' : current));
    }
    if (profile?.gender) setGenderFilter((current) => (current === 'all' ? 'suitable' : current));
    if (profile?.pref_budget_max != null) {
      setMaxPrice((current) => current || String(Math.round(Number(profile.pref_budget_max))));
    }
    if (profile?.pref_gender_policy === 'female' || profile?.pref_gender_policy === 'male') {
      setGenderFilter(profile.pref_gender_policy);
    } else if (profile?.pref_gender_policy === 'any') {
      setGenderFilter('all');
    }
  }, [
    isRenter,
    profile?.city_id,
    profile?.gender,
    profile?.university_id,
    profile?.pref_budget_max,
    profile?.pref_gender_policy,
  ]);

  const selectedUniversity = useMemo(
    () => (isRenter ? null : universities.find((item) => item.id === universityId) ?? null),
    [isRenter, universities, universityId],
  );
  const distancePlace = selectedUniversity ? ('campus' as const) : ('city' as const);

  const load = useCallback(async () => {
    reloadCatalog();
    setLoadError('');
    try {
      const next = await fetchApprovedListings({
        cityId: cityId || undefined,
        universityId: isRenter ? undefined : universityId || undefined,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        gender: genderFilter,
        profileGender: profile?.gender ?? null,
        rooms: roomsFilter || undefined,
        amenities: amenityFilter,
        query: '',
        maxKm: null,
        sort: 'price',
        university: selectedUniversity,
        lang: i18n.language,
        isRenter,
      });
      setApartments(next.map((row) => row.item));
    } catch (err) {
      setApartments([]);
      setLoadError(err instanceof Error ? err.message : t('common.offlineHint'));
    } finally {
      setLoading(false);
      if (profile?.id) {
        try {
          setSavedIds(await loadSavedApartmentIds(profile.id));
        } catch {
          setSavedIds([]);
        }
      }
    }
  }, [
    amenityFilter,
    cityId,
    genderFilter,
    i18n.language,
    isRenter,
    maxPrice,
    profile?.gender,
    profile?.id,
    reloadCatalog,
    roomsFilter,
    selectedUniversity,
    t,
    universityId,
  ]);

  const { refreshing, refresh } = useLiveReload(load, ['apartments', 'saved_apartments'], 'search');

  useEffect(() => {
    void trackEvent('search_open', { role: profile?.role }, profile?.id);
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    if (!profile || apartments.length === 0) return;
    let cancelled = false;
    void (async () => {
      const prefs = await loadSearchAlertPrefs();
      if (!prefs.enabled || cancelled) return;
      const seen = await loadSeenListingIds();
      const seenSet = new Set(seen);
      const matches = apartments.filter((item) => {
        if (seenSet.has(item.id)) return false;
        if (prefs.universityId && item.nearest_university_id !== prefs.universityId) return false;
        if (prefs.cityId && item.city_id !== prefs.cityId) return false;
        if (prefs.maxPrice != null && item.price_month > prefs.maxPrice) return false;
        if (prefs.maxKm != null) {
          const uni = universities.find((u) => u.id === prefs.universityId);
          const km = listingDistanceKm(item, uni ?? null, uni ? null : item.cities);
          if (km == null || km > prefs.maxKm) return false;
        }
        return true;
      });
      await saveSeenListingIds(apartments.map((item) => item.id));
      if (cancelled || matches.length === 0 || seen.length === 0) return;
      alert(t('search.alertTitle'), t('search.alertBody', { count: matches.length }));
    })();
    return () => {
      cancelled = true;
    };
  }, [apartments, profile, t, universities]);

  const toggleSearchAlert = async () => {
    if (!profile) {
      requireAccount();
      return;
    }
    const next = !alertOn;
    setAlertOn(next);
    await saveSearchAlertPrefs({
      enabled: next,
      universityId: universityId || undefined,
      cityId: cityId || undefined,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      maxKm: maxKm ? Number(maxKm) : null,
    });
    const bits = [
      universityId ? 'uni' : '',
      cityId ? 'city' : '',
      maxPrice ? `₪${maxPrice}` : '',
      maxKm ? `${maxKm}km` : '',
    ].filter(Boolean);
    setAlertSummary(bits.join(' · '));
    if (next) {
      await saveSeenListingIds(apartments.map((item) => item.id));
      alert(t('common.done'), t('search.alertEnabled'));
    }
  };

  const filtered = useMemo(
    () =>
      refineListings(apartments, {
        query,
        maxKm: maxKm ? Number(maxKm) : null,
        sort,
        university: selectedUniversity,
        lang: i18n.language,
        isRenter,
        verifiedOnly,
      }),
    [apartments, i18n.language, isRenter, maxKm, query, selectedUniversity, sort, verifiedOnly],
  );

  const paged = usePaged(
    filtered,
    LISTING_PAGE_SIZE,
    [query, cityId, universityId, maxPrice, maxKm, roomsFilter, genderFilter, sort, amenityFilter.join(','), verifiedOnly].join('|'),
  );

  const defaultCityId = isRenter ? (profile?.city_id ?? '') : '';
  const defaultUniversityId = isRenter ? '' : (profile?.university_id ?? '');
  const defaultGender: GenderFilter = profile?.gender ? 'suitable' : 'all';
  const defaultSort: SortMode = !isRenter && defaultUniversityId ? 'distance' : 'price';
  const filtersOn = Boolean(
    query.trim() ||
      cityId !== defaultCityId ||
      universityId !== defaultUniversityId ||
      maxPrice ||
      maxKm ||
      roomsFilter ||
      amenityFilter.length > 0 ||
      verifiedOnly ||
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
    setAmenityFilter([]);
    setVerifiedOnly(false);
    setGenderFilter(defaultGender);
    setSort(defaultSort);
  };

  const toggleAmenity = (key: Amenity) => {
    setAmenityFilter((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
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
    if (amenityFilter.length === 1) parts.push(t(`amenities.${amenityFilter[0]}`));
    else if (amenityFilter.length > 1) parts.push(t('search.amenitiesCount', { count: amenityFilter.length }));
    if (verifiedOnly) parts.push(t('search.verifiedOnly'));
    if (sort === 'rating') parts.push(t('search.sortRating'));
    return parts.join(' · ');
  }, [
    amenityFilter,
    cities,
    cityId,
    genderFilter,
    i18n.language,
    isRenter,
    maxKm,
    maxPrice,
    roomsFilter,
    sort,
    t,
    universities,
    universityId,
    verifiedOnly,
  ]);

  const chipAlign = { justifyContent: isRtl ? ('flex-end' as const) : ('flex-start' as const) };
  const genderItems = [
    ...(profile?.gender ? [{ value: 'suitable' as const, label: t('search.suitable') }] : []),
    { value: 'all' as const, label: t('common.all') },
    { value: 'female' as const, label: t('gender.female') },
    { value: 'male' as const, label: t('gender.male') },
  ];
  const amenityItems = AMENITIES.map((key) => ({ value: key, label: t(`amenities.${key}`) }));
  const sortItems: { value: SortMode; label: string }[] = [
    { value: 'price', label: t('search.sortPrice') },
    { value: 'distance', label: t('search.sortDistance') },
    { value: 'rating', label: t('search.sortRating') },
  ];

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <OfflineBanner />
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

      <View style={[styles.searchBar, row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.primary} />
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
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {profile ? (
        <Pressable
          onPress={() => void toggleSearchAlert()}
          style={[
            styles.alertRow,
            {
              backgroundColor: alertOn ? colors.accentSoft : colors.surface,
              borderColor: alertOn ? colors.accent : colors.border,
            },
            row,
          ]}
        >
          <Ionicons name={alertOn ? 'notifications' : 'notifications-outline'} size={18} color={colors.primary} />
          <Text style={[styles.alertText, rtlText, { color: colors.text }]}>
            {alertOn
              ? `${t('search.alertOn')}${alertSummary ? ` · ${alertSummary}` : ''}`
              : t('search.alertOff')}
          </Text>
        </Pressable>
      ) : null}

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        </View>
        {filtersOpen ? (
          <View style={styles.filtersBody}>
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
              compact
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
            <FilterPills compact value={genderFilter} onChange={setGenderFilter} items={genderItems} />

            <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('search.trust')}</Text>
            <FilterPills
              compact
              value={verifiedOnly ? 'verified' : 'any'}
              onChange={(next) => setVerifiedOnly(next === 'verified')}
              items={[
                { value: 'any', label: t('common.all') },
                { value: 'verified', label: t('search.verifiedOnly') },
              ]}
            />

            <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('listing.amenities')}</Text>
            <FilterPills
              compact
              values={amenityFilter}
              onToggle={toggleAmenity}
              items={amenityItems}
            />

            <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('search.sort')}</Text>
            <FilterPills compact value={sort} onChange={setSort} items={sortItems} />
          </View>
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
      {!loading && loadError ? (
        <EmptyState
          title={t('common.error')}
          hint={loadError}
          actionTitle={t('common.retry')}
          onAction={() => void refresh()}
        />
      ) : null}
      {!loading && !loadError && filtered.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            title={t('search.empty')}
            hint={filtersOn ? t('search.emptyHint') : undefined}
            actionTitle={filtersOn ? t('search.clear') : undefined}
            onAction={filtersOn ? clearFilters : undefined}
          />
        </View>
      ) : null}
      {!loadError
        ? paged.slice.map(({ item, distance }) => (
        <ListingCard
          key={item.id}
          apartment={item}
          ownerVerified={item.profiles?.id_verify_status === 'approved'}
          university={
            isRenter
              ? null
              : distancePlace === 'campus'
                ? ((selectedUniversity ?? item.universities) as University | null)
                : null
          }
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
      ))
        : null}
      {!loading && !loadError && filtered.length > 0 ? (
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
  kicker: { fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  searchBar: {
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    paddingVertical: 6,
  },
  alertRow: {
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  panelHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelHeadCopy: { flex: 1, minWidth: 0, gap: 1 },
  panelHeadActions: { alignItems: 'center', gap: 8, flexShrink: 0 },
  panelTitle: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  panelSummary: { fontSize: 11, lineHeight: 16, fontFamily: 'Cairo_400Regular' },
  panelLabel: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  filtersBody: { gap: spacing.xs },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  filterCell: { flexGrow: 1, flexBasis: '47%', minWidth: 140 },
  metaRow: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  countPill: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  count: { fontSize: 12, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  clear: { fontSize: 12, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  empty: { gap: spacing.sm },
});
