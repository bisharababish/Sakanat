import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { AmenityChips } from '@/components/search/AmenityChips';
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
import { displayName } from '@/src/lib/name';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import {
  loadSearchAlertPrefs,
  loadSeenListingIds,
  listingMatchesAlert,
  saveSearchAlertPrefs,
  saveSeenListingIds,
} from '@/src/lib/searchAlerts';
import { fetchApprovedListings, refineListings } from '@/src/lib/searchListings';
import { apartmentPath, openWelcome, requireAccount } from '@/src/lib/guest';
import { needsLegalAccept } from '@/src/lib/legal';
import { LISTING_PAGE_SIZE } from '@/src/lib/page';
import { supabase } from '@/src/lib/supabase';
import { alert } from '@/src/lib/notice';
import { trackEvent } from '@/src/lib/analytics';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import { AMENITIES, type Amenity, type Apartment, type GenderPolicy, type University } from '@/src/types/database';

type GenderFilter = 'all' | GenderPolicy;
type SortMode = 'price' | 'distance' | 'rating';

const PRICE_OPTIONS = ['400', '600', '800', '1000', '1200', '1500', '2000', '2500', '3000'];

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const legalLock = needsLegalAccept(profile);
  const searchRef = useRef<TextInput>(null);
  const { cities, universities, reload: reloadCatalog } = useCatalog();
  const isRenter = profile?.role === 'renter';
  const cityFirst = isRenter || !profile;
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cityId, setCityId] = useState(isRenter ? (profile?.city_id ?? '') : '');
  const [universityId, setUniversityId] = useState(isRenter ? '' : (profile?.university_id ?? ''));
  const [maxPrice, setMaxPrice] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [sort, setSort] = useState<SortMode>(!isRenter && profile?.university_id ? 'distance' : 'price');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [roomsFilter, setRoomsFilter] = useState('');
  const [bathsFilter, setBathsFilter] = useState('');
  const [amenityFilter, setAmenityFilter] = useState<Amenity[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const alertHydrated = useRef(false);
  const filtersTouched = useRef(false);

  useEffect(() => {
    if (!legalLock) return;
    searchRef.current?.blur();
    Keyboard.dismiss();
  }, [legalLock]);

  useEffect(() => {
    void loadSearchAlertPrefs().then((prefs) => {
      setAlertOn(Boolean(prefs.enabled));
      if (prefs.enabled && !filtersTouched.current) {
        if (prefs.cityId) setCityId(prefs.cityId);
        if (prefs.universityId) setUniversityId(prefs.universityId);
        setMaxPrice(prefs.maxPrice != null ? String(prefs.maxPrice) : '');
        setMaxKm(prefs.maxKm != null ? String(prefs.maxKm) : '');
        if (prefs.rooms) setRoomsFilter(prefs.rooms);
        if (prefs.baths) setBathsFilter(prefs.baths);
        if (prefs.amenities?.length) setAmenityFilter(prefs.amenities as Amenity[]);
        if (prefs.gender && prefs.gender !== 'suitable') setGenderFilter(prefs.gender as GenderFilter);
        if (prefs.query) setQuery(prefs.query);
      }
      alertHydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (!profile || !alertOn || !alertHydrated.current) return;
    const timer = setTimeout(() => {
      void saveSearchAlertPrefs({
        enabled: true,
        universityId: universityId || undefined,
        cityId: cityId || undefined,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        maxKm: maxKm ? Number(maxKm) : null,
        rooms: roomsFilter || undefined,
        baths: bathsFilter || undefined,
        amenities: amenityFilter,
        gender: genderFilter,
        query: query.trim() || undefined,
        verifiedOnly: false,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [alertOn, amenityFilter, bathsFilter, cityId, genderFilter, maxKm, maxPrice, profile, query, roomsFilter, universityId]);

  useEffect(() => {
    if (filtersTouched.current) return;
    if (isRenter) {
      setUniversityId('');
      setMaxKm('');
      setSort((current) => (current === 'distance' ? 'price' : current));
      if (profile?.city_id) setCityId((current) => current || profile.city_id || '');
    } else if (profile?.university_id) {
      setUniversityId((current) => current || profile.university_id || '');
      setSort((current) => (current === 'price' ? 'distance' : current));
      const campus = universities.find((item) => item.id === profile.university_id);
      if (campus?.city_id) setCityId((current) => current || campus.city_id);
    }
    if (profile?.pref_gender_policy === 'female' || profile?.pref_gender_policy === 'male') {
      setGenderFilter(profile.pref_gender_policy);
    } else if (profile?.pref_gender_policy === 'any') {
      setGenderFilter('all');
    }
  }, [
    isRenter,
    profile?.city_id,
    profile?.university_id,
    profile?.pref_gender_policy,
    universities,
  ]);

  useEffect(() => {
    if (!profile?.id) {
      setPendingBooking(false);
      return;
    }
    let alive = true;
    void supabase
      .from('bookings')
      .select('id')
      .eq('student_id', profile.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setPendingBooking(Boolean(data?.id));
      });
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  const selectedUniversity = useMemo(
    () => (isRenter ? null : universities.find((item) => item.id === universityId) ?? null),
    [isRenter, universities, universityId],
  );
  const selectedCity = useMemo(
    () => cities.find((item) => item.id === cityId) ?? null,
    [cities, cityId],
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
        bathrooms: bathsFilter || undefined,
        amenities: amenityFilter,
        query: '',
        maxKm: maxKm ? Number(maxKm) : null,
        sort,
        university: selectedUniversity,
        lang: i18n.language,
        isRenter,
        moveIn: profile?.pref_move_in || undefined,
        leaseMonths: profile?.pref_lease_months || undefined,
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
    bathsFilter,
    cityId,
    genderFilter,
    i18n.language,
    isRenter,
    maxKm,
    maxPrice,
    profile?.gender,
    profile?.id,
    profile?.pref_move_in,
    profile?.pref_lease_months,
    reloadCatalog,
    roomsFilter,
    selectedUniversity,
    sort,
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
        const uni = universities.find((u) => u.id === prefs.universityId);
        const km = listingDistanceKm(item, uni ?? null, uni ? null : item.cities);
        return listingMatchesAlert(item, prefs, km);
      });
      await saveSeenListingIds(apartments.map((item) => item.id));
      if (cancelled || matches.length === 0) return;
      // First enable seeds "seen" silently; only alert on later new matches.
      if (seen.length === 0) return;
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
      rooms: roomsFilter || undefined,
      baths: bathsFilter || undefined,
      amenities: amenityFilter,
      gender: genderFilter,
      query: query.trim() || undefined,
      verifiedOnly: false,
    });
    if (next) {
      await saveSeenListingIds(apartments.map((item) => item.id));
      if (profile.id) {
        void supabase.from('profiles').update({ notify_listing: true }).eq('id', profile.id);
      }
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
      }),
    [apartments, i18n.language, isRenter, maxKm, query, selectedUniversity, sort],
  );

  const paged = usePaged(
    filtered,
    LISTING_PAGE_SIZE,
    [query, cityId, universityId, maxPrice, maxKm, roomsFilter, bathsFilter, genderFilter, sort, amenityFilter.join(',')].join('|'),
  );

  const defaultUniversityId = isRenter ? '' : (profile?.university_id ?? '');
  const defaultCityId = isRenter
    ? (profile?.city_id ?? '')
    : (universities.find((item) => item.id === defaultUniversityId)?.city_id ?? '');
  const defaultGender: GenderFilter = 'all';
  const defaultSort: SortMode = !isRenter && defaultUniversityId ? 'distance' : 'price';
  const filtersOn = Boolean(
    query.trim() ||
      cityId !== defaultCityId ||
      universityId !== defaultUniversityId ||
      maxPrice ||
      maxKm ||
      roomsFilter ||
      bathsFilter ||
      amenityFilter.length > 0 ||
      genderFilter !== defaultGender ||
      sort !== defaultSort,
  );

  const clearFilters = () => {
    filtersTouched.current = true;
    setQuery('');
    setCityId(defaultCityId);
    setUniversityId(defaultUniversityId);
    setMaxPrice('');
    setMaxKm('');
    setRoomsFilter('');
    setBathsFilter('');
    setAmenityFilter([]);
    setGenderFilter(defaultGender);
    setSort(defaultSort);
  };

  const toggleAmenity = (key: Amenity) => {
    setAmenityFilter((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (query.trim()) chips.push({ key: 'query', label: query.trim(), onClear: () => setQuery('') });
    if (cityId && cityId !== defaultCityId) {
      const city = cities.find((item) => item.id === cityId);
      chips.push({
        key: 'city',
        label: city ? localizedName(city, i18n.language) : t('common.city'),
        onClear: () => setCityId(defaultCityId),
      });
    }
    if (!isRenter && universityId && universityId !== defaultUniversityId) {
      const campus = universities.find((item) => item.id === universityId);
      chips.push({
        key: 'uni',
        label: campus ? localizedName(campus, i18n.language) : t('common.university'),
        onClear: () => setUniversityId(defaultUniversityId),
      });
    }
    if (maxPrice) chips.push({ key: 'price', label: `₪${maxPrice}`, onClear: () => setMaxPrice('') });
    if (maxKm) {
      chips.push({
        key: 'km',
        label: maxKm === String(UNDER_ONE_KM) ? t('common.under1km') : `${maxKm} ${t('common.km')}`,
        onClear: () => setMaxKm(''),
      });
    }
    if (roomsFilter) {
      chips.push({
        key: 'rooms',
        label: roomsFilter === '4' ? t('search.roomsPlus') : t('search.rooms') + ' ' + roomsFilter,
        onClear: () => setRoomsFilter(''),
      });
    }
    if (bathsFilter) {
      chips.push({
        key: 'baths',
        label: bathsFilter === '3' ? t('search.bathsPlus') : t('search.baths') + ' ' + bathsFilter,
        onClear: () => setBathsFilter(''),
      });
    }
    if (genderFilter !== defaultGender) {
      chips.push({
        key: 'gender',
        label:
          genderFilter === 'female' || genderFilter === 'male'
            ? t(`gender.${genderFilter}`)
            : t('common.all'),
        onClear: () => setGenderFilter(defaultGender),
      });
    }
    amenityFilter.forEach((item) => {
      chips.push({
        key: `amenity-${item}`,
        label: t(`amenities.${item}`),
        onClear: () => setAmenityFilter((current) => current.filter((key) => key !== item)),
      });
    });
    if (sort !== defaultSort) {
      chips.push({
        key: 'sort',
        label: sort === 'rating' ? t('search.sortRating') : sort === 'distance' ? t('search.sortDistance') : t('search.sortPrice'),
        onClear: () => setSort(defaultSort),
      });
    }
    return chips;
  }, [
    amenityFilter,
    bathsFilter,
    cities,
    cityId,
    defaultCityId,
    defaultGender,
    defaultSort,
    defaultUniversityId,
    genderFilter,
    i18n.language,
    isRenter,
    maxKm,
    maxPrice,
    query,
    roomsFilter,
    sort,
    t,
    universities,
    universityId,
  ]);

  const chipAlign = { justifyContent: isRtl ? ('flex-end' as const) : ('flex-start' as const) };
  const genderItems = [
    { value: 'all' as const, label: t('common.all') },
    { value: 'female' as const, label: t('gender.female') },
    { value: 'male' as const, label: t('gender.male') },
  ];
  const campusOptions = universities.filter(
    (item) => !cityId || item.city_id === cityId || item.id === universityId,
  );
  const sortItems: { value: SortMode; label: string }[] = [
    { value: 'price', label: t('search.sortPrice') },
    ...(selectedUniversity ? [{ value: 'distance' as const, label: t('search.sortDistance') }] : []),
    { value: 'rating', label: t('search.sortRating') },
  ];
  const pickCity = (next: string) => {
    filtersTouched.current = true;
    setCityId(next);
    if (!next) {
      setUniversityId('');
      setMaxKm('');
      setSort((current) => (current === 'distance' ? 'price' : current));
      return;
    }
    if (selectedUniversity && selectedUniversity.city_id !== next) {
      setUniversityId('');
      setMaxKm('');
    }
  };
  const pickUniversity = (next: string) => {
    filtersTouched.current = true;
    setUniversityId(next);
    if (!next) {
      setMaxKm('');
      setSort((current) => (current === 'distance' ? 'price' : current));
    }
    const campus = universities.find((item) => item.id === next);
    if (campus?.city_id) setCityId(campus.city_id);
  };
  const helloName = (displayName(profile, i18n.language) || '').trim().split(/\s+/).filter(Boolean)[0];
  const campusName = selectedUniversity ? localizedName(selectedUniversity, i18n.language) : '';
  const cityName = selectedCity ? localizedName(selectedCity, i18n.language) : '';
  const hello =
    helloName && campusName
      ? t('search.helloCampus', { name: helloName, campus: campusName })
      : helloName && cityName && cityFirst
        ? t('search.helloCity', { name: helloName, city: cityName })
        : helloName
          ? t('search.hello', { name: helloName })
          : t('search.title');
  const subtitle = campusName
    ? null
    : t(cityFirst ? 'search.subtitleRenter' : 'search.subtitle');

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      back={filtersOpen}
      onBack={() => setFiltersOpen(false)}
    >
      <ProfileEnter scene="search" enterOnMount>
      <View style={styles.head}>
        <Text style={[styles.title, rtlText, { color: colors.text }]} numberOfLines={1}>
          {hello}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, rtlText, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>

      {!profile ? (
        <ProfileBanner icon="person-outline" text={t('guest.banner')} onPress={openWelcome} />
      ) : pendingBooking ? (
        <ProfileBanner
          icon="calendar-outline"
          text={t('search.pendingBanner')}
          onPress={() => router.push('/(student)/(tabs)/bookings')}
        />
      ) : null}

      <View style={[styles.searchBar, row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.primary} />
        <TextInput
          ref={searchRef}
          value={query}
          onChangeText={setQuery}
          placeholder={t(cityFirst ? 'search.placeholderRenter' : 'search.placeholder')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoFocus={false}
          editable={!legalLock}
          showSoftInputOnFocus={!legalLock}
          returnKeyType="search"
          style={[styles.searchInput, { textAlign, writingDirection, color: colors.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('search.clear')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.tools, row]}>
        <Pressable
          onPress={() => setFiltersOpen((open) => !open)}
          style={[
            styles.tool,
            row,
            {
              backgroundColor: filtersOpen || filtersOn ? colors.primarySoft : colors.surface,
              borderColor: filtersOpen || filtersOn ? colors.primary : colors.border,
            },
          ]}
        >
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <Text style={[styles.toolText, { color: colors.text }]}>{t('search.filters')}</Text>
          {filtersOn ? (
            <View style={[styles.toolBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.toolBadgeText, { color: colors.white }]}>{filterChips.length || '•'}</Text>
            </View>
          ) : null}
        </Pressable>
        {profile ? (
          <Pressable
            onPress={() => void toggleSearchAlert()}
            style={[
              styles.tool,
              row,
              {
                backgroundColor: alertOn ? colors.primarySoft : colors.surface,
                borderColor: alertOn ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name={alertOn ? 'notifications' : 'notifications-outline'} size={16} color={colors.primary} />
            <Text style={[styles.toolText, { color: colors.text }]}>
              {alertOn ? t('search.alertOnShort') : t('search.alertOffShort')}
            </Text>
          </Pressable>
        ) : null}
        {profile && savedIds.length > 0 ? (
          <Pressable
            onPress={() => router.push({ pathname: '/(student)/(tabs)/profile', params: { tab: 'saved' } })}
            style={[styles.tool, row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="heart" size={16} color={colors.danger} />
            <Text style={[styles.toolText, { color: colors.text }]}>
              {t('search.savedCount', { count: savedIds.length })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!filtersOpen && filterChips.length > 0 ? (
        <View style={[styles.chips, chipAlign]}>
          {filterChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.onClear}
              style={[styles.chip, row, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
            >
              <Text style={[styles.chipText, { color: colors.primaryDark }]} numberOfLines={1}>
                {chip.label}
              </Text>
              <Ionicons name="close" size={12} color={colors.primary} />
            </Pressable>
          ))}
          {filtersOn ? (
            <Pressable onPress={clearFilters} hitSlop={8} style={styles.chipClear}>
              <Text style={[styles.clear, { color: colors.primary }]}>{t('search.clear')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {filtersOpen ? (
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {filtersOn ? (
            <Pressable onPress={clearFilters} hitSlop={8} style={{ alignSelf: isRtl ? 'flex-end' : 'flex-start' }}>
              <Text style={[styles.clear, { color: colors.primary }]}>{t('search.clear')}</Text>
            </Pressable>
          ) : null}
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
                  onChange={pickCity}
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
                      ...campusOptions.map((item) => ({
                        value: item.id,
                        label: item.cities
                          ? `${localizedName(item, i18n.language)} — ${localizedName(item.cities, i18n.language)}`
                          : localizedName(item, i18n.language),
                      })),
                    ]}
                    onChange={pickUniversity}
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
                    ...PRICE_OPTIONS.map((value) => ({ value, label: `₪${value}` })),
                  ]}
                  onChange={setMaxPrice}
                />
              </View>
              {selectedUniversity ? (
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
              ) : null}
              <View style={styles.filterCell}>
                <Select
                  compact
                  icon="bed-outline"
                  label={t('search.rooms')}
                  value={roomsFilter}
                  placeholder={t('search.rooms')}
                  options={[
                    { value: '', label: t('common.all') },
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: t('search.roomsPlus') },
                  ]}
                  onChange={setRoomsFilter}
                />
              </View>
              <View style={styles.filterCell}>
                <Select
                  compact
                  icon="water-outline"
                  label={t('search.baths')}
                  value={bathsFilter}
                  placeholder={t('search.baths')}
                  options={[
                    { value: '', label: t('common.all') },
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: t('search.bathsPlus') },
                  ]}
                  onChange={setBathsFilter}
                />
              </View>
            </View>

            <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('search.whoFor')}</Text>
            <FilterPills compact value={genderFilter} onChange={setGenderFilter} items={genderItems} />

            <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('listing.amenities')}</Text>
            <AmenityChips values={amenityFilter} onToggle={toggleAmenity} />

            <Text style={[styles.panelLabel, rtlText, { color: colors.textMuted }]}>{t('search.sort')}</Text>
            <FilterPills compact value={sort} onChange={setSort} items={sortItems} />
          </View>
      </View>
      ) : null}

      <View style={[styles.metaRow, row]}>
        <View style={[styles.countPill, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={[styles.count, { color: colors.primaryDark }]}>
            {loading ? t('common.loading') : t('search.results', { count: filtered.length })}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.skelWrap}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[styles.skelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.skelCover, { backgroundColor: colors.surfaceMuted }]} />
              <View style={styles.skelBody}>
                <View style={[styles.skelLine, { backgroundColor: colors.surfaceMuted, width: '72%' }]} />
                <View style={[styles.skelLine, { backgroundColor: colors.surfaceMuted, width: '44%' }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
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
            hint={
              filtersOn
                ? t('search.emptyHint')
                : profile?.pref_move_in || profile?.pref_lease_months
                  ? t('search.emptyPrefs')
                  : cityFirst
                    ? t('search.emptyRenter')
                    : !cityId && !universityId
                      ? t('search.emptyNationwide')
                      : t('search.emptyCampus')
            }
            actionTitle={
              filtersOn || cityId || universityId ? t('search.clearToAll') : undefined
            }
            onAction={
              filtersOn || cityId || universityId
                ? () => {
                    filtersTouched.current = true;
                    setQuery('');
                    setCityId('');
                    setUniversityId('');
                    setMaxPrice('');
                    setMaxKm('');
                    setRoomsFilter('');
                    setBathsFilter('');
                    setAmenityFilter([]);
                    setGenderFilter('all');
                    setSort('price');
                  }
                : undefined
            }
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
              requireAccount(item.id, 'save');
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
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  subtitle: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 18 },
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
  searchBar: {
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    paddingVertical: 8,
  },
  tools: { flexWrap: 'wrap', gap: 8 },
  tool: {
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  toolBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toolBadgeText: { fontSize: 10, fontFamily: 'Cairo_800ExtraBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  chipText: { fontSize: 11, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
  chipClear: { alignSelf: 'center', paddingHorizontal: 4 },
  alertRow: {
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  panel: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  panelLabel: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  filtersBody: { gap: spacing.xs },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  filterCell: { flexGrow: 1, flexBasis: '47%', minWidth: 140 },
  metaRow: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  countPill: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  count: { fontSize: 12, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  clear: { fontSize: 12, fontFamily: 'Cairo_700Bold', fontWeight: '700' },
  empty: { gap: spacing.sm },
  skelWrap: { gap: spacing.sm },
  skelCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 8,
    gap: 10,
    alignItems: 'center',
  },
  skelCover: { height: 108, width: 108, borderRadius: 18 },
  skelBody: { flex: 1, gap: 8 },
  skelLine: { height: 10, borderRadius: 6 },
});
