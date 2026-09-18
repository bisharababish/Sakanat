import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, findNodeHandle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { CAMPUS_KM_VALUES, campusKmChipValue, UNDER_ONE_KM } from '@/src/lib/distance';
import { localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { apartmentWriteFields, copyListingTitles } from '@/src/lib/listing';
import {
  listingPlacePayload,
  isListingPlaceSqlMissing,
} from '@/src/lib/listingPlace';
import { applyStayToBuilding, isListingStaySqlMissing, listingNeedsStayNotes, listingStayPayload, stayFromApartment } from '@/src/lib/listingStay';
import {
  LISTING_MIN_PHOTOS,
  listingQualityIssues,
  type ListingQualityIssue,
} from '@/src/lib/listingQuality';
import { pickListingPhotos } from '@/src/lib/pickImage';
import { ownerListingGapTab } from '@/src/lib/studentProfile';
import { supabase } from '@/src/lib/supabase';
import { listingGateMessage, ownerReadyForListing } from '@/src/lib/trust';
import { uploadApartmentPhoto } from '@/src/lib/upload';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import { AMENITIES, type Apartment, type GenderPolicy, type ListingStatus } from '@/src/types/database';

type Props = {
  apartment?: Apartment | null;
  asAdmin?: boolean;
  ownerId?: string;
  focus?: string;
};

const ROOM_COUNTS = ['1', '2', '3', '4', '5', '6'];
const BATH_COUNTS = ['1', '2', '3', '4'];
const FLOOR_VALUES = ['-1', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export function ListingEditor({ apartment, asAdmin, ownerId, focus }: Props) {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const { cities, universities } = useCatalog();
  const [titleAr, setTitleAr] = useState(apartment?.title_ar ?? '');
  const [titleEn, setTitleEn] = useState(apartment?.title_en ?? '');
  const [descAr, setDescAr] = useState(apartment?.description_ar ?? '');
  const [descEn, setDescEn] = useState(apartment?.description_en ?? '');
  const [cityId, setCityId] = useState(apartment?.city_id ?? profile?.city_id ?? '');
  const [universityId, setUniversityId] = useState(apartment?.nearest_university_id ?? '');
  const [price, setPrice] = useState(apartment ? String(apartment.price_month) : '');
  const [rooms, setRooms] = useState(apartment ? String(apartment.rooms) : '1');
  const [baths, setBaths] = useState(apartment ? String(apartment.bathrooms) : '1');
  const [area, setArea] = useState(apartment?.area_m2 ? String(apartment.area_m2) : '');
  const [campusKm, setCampusKm] = useState(campusKmChipValue(apartment?.campus_distance_km));
  const [buildingName, setBuildingName] = useState(apartment?.building_name ?? '');
  const [floor, setFloor] = useState(apartment?.floor == null ? '' : String(apartment.floor));
  const [unitNumber, setUnitNumber] = useState(apartment?.unit_number ?? '');
  const [houseRulesAr, setHouseRulesAr] = useState(apartment?.house_rules_ar ?? '');
  const [houseRulesEn, setHouseRulesEn] = useState(apartment?.house_rules_en ?? '');
  const [checkInAr, setCheckInAr] = useState(apartment?.check_in_notes_ar ?? '');
  const [checkInEn, setCheckInEn] = useState(apartment?.check_in_notes_en ?? '');
  const [knownBuildings, setKnownBuildings] = useState<string[]>([]);
  const [buildingStay, setBuildingStay] = useState<Record<string, ReturnType<typeof stayFromApartment>>>({});
  const [buildingCounts, setBuildingCounts] = useState<Record<string, number>>({});
  const [gender, setGender] = useState<GenderPolicy>(apartment?.gender_policy ?? 'any');
  const [amenities, setAmenities] = useState<string[]>(apartment?.amenities ?? []);
  const [photos, setPhotos] = useState<string[]>(apartment?.photos ?? []);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [listingStatus, setListingStatus] = useState<ListingStatus>(
    apartment?.status ?? (asAdmin ? 'approved' : 'pending'),
  );
  const [loading, setLoading] = useState(false);
  const [applyingStay, setApplyingStay] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const unitInputRef = useRef<TextInput>(null);
  const unitWrapRef = useRef<View>(null);
  const stayGap = listingNeedsStayNotes({
    house_rules_ar: houseRulesAr,
    house_rules_en: houseRulesEn,
    check_in_notes_ar: checkInAr,
    check_in_notes_en: checkInEn,
  });

  const chipAlign = { justifyContent: isRtl ? ('flex-end' as const) : ('flex-start' as const) };
  const cityUniversities = useMemo(
    () => universities.filter((item) => !cityId || item.city_id === cityId),
    [cityId, universities],
  );
  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const universityOptions = useMemo(
    () => cityUniversities.map((item) => ({ value: item.id, label: localizedName(item, i18n.language) })),
    [cityUniversities, i18n.language],
  );

  useEffect(() => {
    const owner = apartment?.owner_id || ownerId || (!asAdmin ? profile?.id : '');
    if (!owner) return;
    let alive = true;
    void supabase
      .from('apartments')
      .select('building_name, house_rules_ar, house_rules_en, check_in_notes_ar, check_in_notes_en')
      .eq('owner_id', owner)
      .then(({ data, error }) => {
        if (!alive) return;
        const rows = error
          ? []
          : ((data as {
              building_name?: string | null;
              house_rules_ar?: string | null;
              house_rules_en?: string | null;
              check_in_notes_ar?: string | null;
              check_in_notes_en?: string | null;
            }[]) ?? []);
        const names = [
          ...new Set(rows.map((row) => (row.building_name ?? '').trim()).filter(Boolean)),
        ].sort((a, b) => a.localeCompare(b, i18n.language.startsWith('ar') ? 'ar' : 'en'));
        setKnownBuildings(names);
        const stay: Record<string, ReturnType<typeof stayFromApartment>> = {};
        const counts: Record<string, number> = {};
        for (const row of rows) {
          const key = (row.building_name ?? '').trim().toLowerCase();
          if (!key) continue;
          counts[key] = (counts[key] ?? 0) + 1;
          const next = stayFromApartment(row);
          const hasStay = Boolean(
            next.house_rules_ar || next.house_rules_en || next.check_in_notes_ar || next.check_in_notes_en,
          );
          if (hasStay && !stay[key]) stay[key] = next;
        }
        setBuildingStay(stay);
        setBuildingCounts(counts);
        if (error) {
          void supabase
            .from('apartments')
            .select('building_name')
            .eq('owner_id', owner)
            .then(({ data: fallback }) => {
              if (!alive) return;
              const fallbackNames = [
                ...new Set(
                  ((fallback as { building_name?: string | null }[]) ?? [])
                    .map((row) => (row.building_name ?? '').trim())
                    .filter(Boolean),
                ),
              ].sort((a, b) => a.localeCompare(b, i18n.language.startsWith('ar') ? 'ar' : 'en'));
              setKnownBuildings(fallbackNames);
            });
        }
      });
    return () => {
      alive = false;
    };
  }, [apartment?.owner_id, asAdmin, i18n.language, ownerId, profile?.id]);

  useEffect(() => {
    if (focus !== 'unit') return;
    const timer = setTimeout(() => {
      const scrollNode = findNodeHandle(scrollRef.current);
      const wrap = unitWrapRef.current;
      if (scrollNode && wrap) {
        wrap.measureLayout(
          scrollNode,
          (_x, y) => {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
          },
          () => {},
        );
      }
      unitInputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, [focus]);

  const applyBuilding = (next: string) => {
    setBuildingName(next);
    const stay = buildingStay[next.trim().toLowerCase()];
    if (!stay) return;
    if (!houseRulesAr.trim() && stay.house_rules_ar) setHouseRulesAr(stay.house_rules_ar);
    if (!houseRulesEn.trim() && stay.house_rules_en) setHouseRulesEn(stay.house_rules_en);
    if (!checkInAr.trim() && stay.check_in_notes_ar) setCheckInAr(stay.check_in_notes_ar);
    if (!checkInEn.trim() && stay.check_in_notes_en) setCheckInEn(stay.check_in_notes_en);
  };

  const buildingUnitCount = buildingCounts[buildingName.trim().toLowerCase()] ?? 0;

  const pushStayToBuilding = () => {
    const listingOwnerId = apartment?.owner_id || ownerId || (!asAdmin ? profile?.id : '');
    const name = buildingName.trim();
    if (!listingOwnerId || !name) return;
    const stay = listingStayPayload(houseRulesAr, houseRulesEn, checkInAr, checkInEn);
    alert(t('owner.applyStayBuilding'), t('owner.applyStayConfirm', { count: Math.max(buildingUnitCount, 1), name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.applyStayBuilding'),
        onPress: () => {
          void (async () => {
            setApplyingStay(true);
            try {
              const count = await applyStayToBuilding({ ownerId: listingOwnerId, buildingName: name, stay });
              alert(t('common.done'), t('owner.applyStayDone', { count }));
            } catch (err) {
              alert(t('common.error'), err instanceof Error ? err.message : '');
            } finally {
              setApplyingStay(false);
            }
          })();
        },
      },
    ]);
  };

  const setCity = (next: string) => {
    setCityId(next);
    if (next && universityId) {
      const stillValid = universities.some((item) => item.id === universityId && item.city_id === next);
      if (!stillValid) setUniversityId('');
    }
  };

  const toggleAmenity = (key: string) => {
    setAmenities((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const addPhoto = async () => {
    if (!profile) return;
    const uris = await pickListingPhotos(Math.max(1, 12 - photos.length));
    if (!uris.length) return;
    setLoading(true);
    try {
      const urls: string[] = [];
      for (const uri of uris) {
        urls.push(await uploadApartmentPhoto(profile.id, uri));
      }
      setPhotos((current) => [...current, ...urls].slice(0, 12));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  const setCover = (uri: string) => {
    setPhotos((current) => [uri, ...current.filter((item) => item !== uri)]);
  };

  const onPhotoPress = (uri: string, index: number) => {
    alert(t('owner.photoActions'), '', [
      ...(index > 0 ? [{ text: t('owner.setCover'), onPress: () => setCover(uri) }] : []),
      {
        text: t('owner.removePhoto'),
        style: 'destructive' as const,
        onPress: () => setPhotos((current) => current.filter((item) => item !== uri)),
      },
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const gateOwnerWrite = () => {
    if (asAdmin) return true;
    if (ownerReadyForListing(profile)) return true;
    if (profile?.owner_status === 'pending') {
      alert(t('common.error'), t('owner.listingNeedApproval'));
      return false;
    }
    if (profile?.owner_status === 'rejected') {
      alert(t('common.error'), t('owner.listingSuspended'));
      return false;
    }
    alert(t('common.error'), t('owner.listingNeedVerify'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.title'),
        onPress: () =>
          router.push({
            pathname: '/(owner)/(tabs)/profile',
            params: { tab: ownerListingGapTab(profile) },
          }),
      },
    ]);
    return false;
  };

  const duplicateListing = async () => {
    if (!apartment || !profile) return;
    if (!gateOwnerWrite()) return;
    setLoading(true);
    try {
      const payload = {
        ...apartmentWriteFields(apartment),
        ...copyListingTitles(apartment, t('owner.copySuffix')),
        photos,
        amenities,
        unit_number: null,
      };
      const { data, error } = await supabase.from('apartments').insert(payload).select('id').single();
      if (error) throw error;
      alert(t('common.done'), t('owner.duplicated'));
      if (data?.id) router.replace({ pathname: '/(owner)/listing/[id]', params: { id: data.id, focus: 'unit' } });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      alert(t('common.error'), listingGateMessage(raw, t) || raw);
    } finally {
      setLoading(false);
    }
  };

  const qualityMessage = (issues: ListingQualityIssue[]) =>
    issues
      .map((issue) => {
        if (issue === 'photos') return t('owner.qualityPhotos', { count: LISTING_MIN_PHOTOS });
        if (issue === 'description') return t('owner.qualityDescription');
        if (issue === 'amenities') return t('owner.qualityAmenities');
        if (issue === 'campus') return t('owner.qualityCampus');
        if (issue === 'place') return t('owner.qualityPlace');
        if (issue === 'title') return t('auth.missingFields');
        if (issue === 'city') return t('auth.missingFields');
        return t('auth.missingFields');
      })
      .join('\n');

  const save = async (opts?: { ignoreStayGap?: boolean }) => {
    const listingOwnerId = apartment?.owner_id || ownerId || (!asAdmin ? profile?.id : '');
    if (!profile || !listingOwnerId) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    if (!apartment && !gateOwnerWrite()) return;

    const stay = listingStayPayload(houseRulesAr, houseRulesEn, checkInAr, checkInEn);
    const issues = listingQualityIssues({
      titleAr,
      titleEn,
      descriptionAr: descAr,
      descriptionEn: descEn,
      cityId,
      price,
      photos,
      amenities,
      universityId,
      campusKm,
      buildingName,
      floor,
      unitNumber,
    });
    if (issues.length > 0 && !asAdmin) {
      alert(t('owner.qualityTitle'), qualityMessage(issues));
      return;
    }
    if (!asAdmin && !opts?.ignoreStayGap && listingNeedsStayNotes(stay)) {
      alert(t('owner.qualityTitle'), t('owner.needsStayNotes'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('owner.saveAnyway'), onPress: () => void save({ ignoreStayGap: true }) },
      ]);
      return;
    }

    const city = cities.find((item) => item.id === cityId);
    const university = universities.find((item) => item.id === universityId);
    const place = listingPlacePayload(buildingName, floor, unitNumber);
    const payload = {
      owner_id: listingOwnerId,
      city_id: cityId,
      nearest_university_id: universityId || null,
      title_ar: titleAr.trim(),
      title_en: (titleEn || titleAr).trim(),
      description_ar: descAr.trim(),
      description_en: (descEn || descAr).trim(),
      price_month: Number(price),
      rooms: Number(rooms) || 1,
      bathrooms: Number(baths) || 1,
      area_m2: area ? Number(area) : null,
      gender_policy: gender,
      amenities,
      photos,
      lat: university?.lat ?? city?.lat ?? 31.9,
      lng: university?.lng ?? city?.lng ?? 35.2,
      campus_distance_km: campusKm ? Number(campusKm) : null,
      ...place,
      ...stay,
    };
    const resubmit =
      !asAdmin &&
      apartment &&
      (apartment.status === 'approved' || apartment.status === 'hidden' || apartment.status === 'rejected');
    setLoading(true);
    const write = async (body: Record<string, unknown>, id?: string) => {
      const persist = (next: Record<string, unknown>) =>
        id ? supabase.from('apartments').update(next).eq('id', id) : supabase.from('apartments').insert(next);
      const first = await persist(body);
      if (!first.error) return;
      let next = body;
      let err = first.error;
      const notices: string[] = [];
      if (isListingStaySqlMissing(err.message)) {
        const {
          house_rules_ar: _hrAr,
          house_rules_en: _hrEn,
          check_in_notes_ar: _ciAr,
          check_in_notes_en: _ciEn,
          ...restStay
        } = next;
        next = restStay;
        notices.push(t('owner.stayNeedsSql'));
        const retryStay = await persist(next);
        if (!retryStay.error) {
          alert(t('common.error'), notices.join('\n\n'));
          return;
        }
        err = retryStay.error;
      }
      if (isListingPlaceSqlMissing(err.message)) {
        const { building_name: _b, floor: _f, unit_number: _u, ...rest } = next;
        next = rest;
        notices.push(t('owner.placeNeedsSql'));
        const retry = await persist(next);
        if (!retry.error) {
          alert(t('common.error'), notices.join('\n\n'));
          return;
        }
        err = retry.error;
      }
      throw err;
    };
    try {
      if (apartment) {
        const update = asAdmin
          ? { ...payload, status: listingStatus }
          : resubmit
            ? { ...payload, status: 'pending' as const, reject_reason: null }
            : payload;
        await write(update, apartment.id);
      } else if (asAdmin) {
        await write({ ...payload, status: listingStatus });
      } else {
        await write(payload);
      }
      if (resubmit) {
        alert(t('common.done'), t('owner.sentForReview'), [
          { text: t('common.done'), onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
      if (!asAdmin && profile?.id) {
        void import('@/src/lib/analytics').then(({ trackEvent }) =>
          trackEvent('listing_submit', { apartmentId: apartment?.id }, profile.id),
        );
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      alert(t('common.error'), listingGateMessage(raw, t) || raw);
    } finally {
      setLoading(false);
    }
  };

  const setVisibility = (next: 'hidden' | 'approved') => {    if (!apartment) return;
    if (next === 'approved' && !gateOwnerWrite()) return;
    const run = async () => {
      const { error } = await supabase.from('apartments').update({ status: next }).eq('id', apartment.id);
      if (error) alert(t('common.error'), listingGateMessage(error.message, t) || error.message);
      else router.back();
    };
    if (next === 'hidden') {
      alert(t('owner.hideListing'), t('owner.confirmHide'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('owner.hideListing'), onPress: () => void run() },
      ]);
      return;
    }
    void run();
  };

  const removeListing = () => {
    if (!apartment) return;
    alert(t('owner.deleteListing'), t('owner.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', apartment.id);
          if (error) alert(t('common.error'), error.message);
          else router.back();
        },
      },
    ]);
  };

  const cover = photos[0];

  return (
    <>
    <Screen back scrollRef={scrollRef}>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{apartment ? t('owner.editListing') : t('owner.addListing')}</Text>
      <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>{t('owner.addHint')}</Text>

      <Card>
        <SectionHead icon="images-outline" title={t('owner.photos')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
          {t('owner.qualityPhotosHint', { count: LISTING_MIN_PHOTOS })}
        </Text>
        {cover ? (
          <Pressable
            onPress={() => setViewerIndex(0)}
            onLongPress={() => onPhotoPress(cover, 0)}
            delayLongPress={280}
            accessibilityRole="button"
            accessibilityLabel={t('listing.viewPhoto')}
            style={styles.coverWrap}
          >
            <Image source={{ uri: cover }} style={[styles.cover, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
            <View style={[styles.coverBadge, isRtl ? styles.coverBadgeStart : styles.coverBadgeEnd, { backgroundColor: colors.primary }]}>
              <Text style={[styles.coverBadgeText, { color: colors.white }]}>{t('owner.coverPhoto')}</Text>
            </View>
          </Pressable>
        ) : null}
        <View style={[styles.photoGrid, chipAlign]}>
          {photos.slice(1).map((uri, index) => (
            <Pressable
              key={uri}
              onPress={() => setViewerIndex(index + 1)}
              onLongPress={() => onPhotoPress(uri, index + 1)}
              delayLongPress={280}
              accessibilityRole="button"
              accessibilityLabel={t('listing.viewPhoto')}
              style={styles.photoWrap}
            >
              <Image source={{ uri }} style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
            </Pressable>
          ))}
          {photos.length < 12 ? (
            <Pressable
              onPress={() => void addPhoto()}
              style={[styles.addTile, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              disabled={loading}
            >
              <Ionicons name="camera-outline" size={26} color={colors.primary} />
              <Text style={[styles.addTileText, { color: colors.primary }]}>
                {photos.length === 0 ? t('owner.addPhoto') : t('owner.addMorePhotos')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionHead icon="create-outline" title={t('owner.basicsTitle')} />
        <Input label={t('owner.titleAr')} value={titleAr} onChangeText={setTitleAr} />
        <Input label={t('owner.titleEn')} value={titleEn} onChangeText={setTitleEn} />
        <Input label={t('owner.descAr')} value={descAr} onChangeText={setDescAr} multiline />
        <Input label={t('owner.descEn')} value={descEn} onChangeText={setDescEn} multiline />
      </Card>

      <Card>
        <SectionHead icon="location-outline" title={t('owner.locationTitle')} />
        <Select
          label={t('common.city')}
          value={cityId}
          placeholder={t('common.select')}
          options={cityOptions}
          onChange={setCity}
        />
        {!asAdmin && profile?.city_id && cityId && profile.city_id !== cityId ? (
          <Text style={[styles.hint, rtlText, { color: colors.warning }]}>{t('owner.cityMismatch')}</Text>
        ) : null}
        <SearchSelect
          label={t('owner.nearestUni')}
          value={universityId}
          placeholder={t('common.select')}
          options={universityOptions}
          onChange={setUniversityId}
          clearable
        />
        <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('owner.campusKm')}</Text>
        <FilterPills
          value={campusKm}
          onChange={setCampusKm}
          allowDeselect
          items={CAMPUS_KM_VALUES.map((km) => ({
            value: String(km),
            label: km === UNDER_ONE_KM ? t('common.under1km') : `${km} ${t('common.km')}`,
          }))}
        />
      </Card>

      <Card>
        <SectionHead icon="business-outline" title={t('owner.placeTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('owner.placeHint')}</Text>
        <Input
          label={t('owner.buildingName')}
          value={buildingName}
          onChangeText={setBuildingName}
          hint={t('owner.buildingNameHint')}
        />
        {knownBuildings.length > 0 ? (
          <>
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('owner.yourBuildings')}</Text>
            <FilterPills
              value={buildingName}
              onChange={applyBuilding}
              allowDeselect
              items={knownBuildings.map((name) => ({ value: name, label: name }))}
            />
          </>
        ) : null}
        <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('owner.floor')}</Text>
        <FilterPills
          value={floor}
          onChange={setFloor}
          allowDeselect
          items={FLOOR_VALUES.map((value) => ({
            value,
            label:
              value === '-1'
                ? t('owner.floorBasement')
                : value === '0'
                  ? t('owner.floorGround')
                  : t('owner.floorN', { n: value }),
          }))}
        />
        <Input
          label={t('owner.floorCustom')}
          value={floor}
          onChangeText={(value) => setFloor(value.replace(/[^\d-]/g, '').slice(0, 4))}
          keyboardType="numbers-and-punctuation"
          hint={t('owner.floorCustomHint')}
        />
        <View ref={unitWrapRef} collapsable={false}>
          <Input
            label={t('owner.unitNumber')}
            value={unitNumber}
            onChangeText={setUnitNumber}
            hint={t('owner.unitNumberHint')}
            inputRef={unitInputRef}
          />
        </View>
      </Card>

      <Card>
        <SectionHead icon="clipboard-outline" title={t('owner.stayTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('owner.stayHint')}</Text>
        {stayGap ? (
          <Text style={[styles.hint, rtlText, { color: colors.warning }]}>{t('owner.stayQualityHint')}</Text>
        ) : null}
        <Input
          label={t('owner.houseRulesAr')}
          value={houseRulesAr}
          onChangeText={setHouseRulesAr}
          multiline
          maxLength={800}
          hint={t('owner.houseRulesHint')}
        />
        <Input
          label={t('owner.houseRulesEn')}
          value={houseRulesEn}
          onChangeText={setHouseRulesEn}
          multiline
          maxLength={800}
        />
        <Input
          label={t('owner.checkInAr')}
          value={checkInAr}
          onChangeText={setCheckInAr}
          multiline
          maxLength={600}
          hint={t('owner.checkInHint')}
        />
        <Input
          label={t('owner.checkInEn')}
          value={checkInEn}
          onChangeText={setCheckInEn}
          multiline
          maxLength={600}
        />
        {buildingName.trim() && (buildingUnitCount > 1 || apartment) ? (
          <Button
            title={t('owner.applyStayBuilding')}
            variant="secondary"
            pill
            loading={applyingStay}
            onPress={pushStayToBuilding}
          />
        ) : null}
      </Card>

      <Card>
        <SectionHead icon="home-outline" title={t('owner.detailsTitle')} />
        <Input label={t('common.price')} value={price} onChangeText={setPrice} keyboardType="numeric" />
        <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('common.rooms')}</Text>
        <FilterPills
          value={rooms}
          onChange={setRooms}
          items={ROOM_COUNTS.map((value) => ({ value, label: value }))}
        />
        <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('common.bathrooms')}</Text>
        <FilterPills
          value={baths}
          onChange={setBaths}
          items={BATH_COUNTS.map((value) => ({ value, label: value }))}
        />
        <Input label={t('owner.area')} value={area} onChangeText={setArea} keyboardType="numeric" />
      </Card>

      <Card>
        <SectionHead icon="people-outline" title={t('search.whoFor')} />
        <FilterPills
          value={gender}
          onChange={setGender}
          items={(['any', 'female', 'male'] as GenderPolicy[]).map((value) => ({
            value,
            label: t(`gender.${value}`),
          }))}
        />
      </Card>

      <Card>
        <SectionHead icon="star-outline" title={t('listing.amenities')} />
        <FilterPills
          values={amenities}
          onToggle={toggleAmenity}
          items={AMENITIES.map((item) => ({
            value: item,
            label: t(`amenities.${item}`),
          }))}
        />
      </Card>

      {asAdmin ? (
        <Card>
          <SectionHead icon="shield-checkmark-outline" title={t('admin.listingStatus')} />
          <FilterPills
            value={listingStatus}
            onChange={setListingStatus}
            items={(['pending', 'approved', 'hidden', 'rejected'] as ListingStatus[]).map((value) => ({
              value,
              label: t(`status.${value}`),
            }))}
          />
        </Card>
      ) : null}

      {!asAdmin && apartment?.status === 'rejected' && apartment.reject_reason ? (
        <Text style={[styles.note, rtlText, { color: colors.warning }]}>
          {t('admin.rejectedNote', { note: apartment.reject_reason })}
        </Text>
      ) : null}
      {!asAdmin &&
      (apartment?.status === 'approved' || apartment?.status === 'hidden' || apartment?.status === 'rejected') ? (
        <Text style={[styles.note, rtlText, { color: colors.warning }]}>{t('owner.editNeedsReview')}</Text>
      ) : null}

      <Button title={t('common.save')} onPress={() => void save()} loading={loading} compact pill />
      {apartment && !asAdmin ? (
        <Button
          title={t('owner.preview')}
          variant="secondary"
          compact
          onPress={() => router.push({ pathname: '/(owner)/apartment/[id]', params: { id: apartment.id } })}
          pill
        />
      ) : null}
      {apartment && !asAdmin ? (
        <Button
          title={t('owner.duplicate')}
          variant="secondary"
          compact
          onPress={() => void duplicateListing()}
          loading={loading}
          pill
        />
      ) : null}
      {apartment?.status === 'approved' ? (
        <Button title={t('owner.hideListing')} variant="secondary" compact onPress={() => setVisibility('hidden')} pill />
      ) : null}
      {apartment?.status === 'hidden' ? (
        <Button title={t('owner.unhideListing')} variant="secondary" compact onPress={() => setVisibility('approved')} pill />
      ) : null}
      {apartment ? (
        <Button title={t('owner.deleteListing')} variant="danger" compact onPress={removeListing} pill />
      ) : null}
    </Screen>
      <PhotoViewer
        photos={photos}
        index={viewerIndex ?? 0}
        visible={viewerIndex != null && photos.length > 0}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 14, fontFamily: 'Cairo_400Regular', marginTop: -4, marginBottom: 4 },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  label: { fontWeight: '800', fontFamily: 'Cairo_700Bold', fontSize: 14 },
  coverWrap: { width: '100%', height: 196 },
  cover: { width: '100%', height: 196, borderRadius: radius.lg },
  coverBadge: {
    position: 'absolute',
    bottom: 10,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coverBadgeStart: { start: 10 },
  coverBadgeEnd: { end: 10 },
  coverBadgeText: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileText: { fontSize: 11, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  note: { lineHeight: 22, fontFamily: 'Cairo_400Regular' },
});
