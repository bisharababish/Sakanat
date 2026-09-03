import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
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
import { pickListingPhotos } from '@/src/lib/pickImage';
import { supabase } from '@/src/lib/supabase';
import { uploadApartmentPhoto } from '@/src/lib/upload';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import { AMENITIES, type Apartment, type GenderPolicy, type ListingStatus } from '@/src/types/database';

type Props = {
  apartment?: Apartment | null;
  asAdmin?: boolean;
  ownerId?: string;
};

const ROOM_COUNTS = ['1', '2', '3', '4', '5', '6'];
const BATH_COUNTS = ['1', '2', '3', '4'];

export function ListingEditor({ apartment, asAdmin, ownerId }: Props) {
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
  const [gender, setGender] = useState<GenderPolicy>(apartment?.gender_policy ?? 'any');
  const [amenities, setAmenities] = useState<string[]>(apartment?.amenities ?? []);
  const [photos, setPhotos] = useState<string[]>(apartment?.photos ?? []);
  const [listingStatus, setListingStatus] = useState<ListingStatus>(
    apartment?.status ?? (asAdmin ? 'approved' : 'pending'),
  );
  const [loading, setLoading] = useState(false);

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

  const duplicateListing = async () => {
    if (!apartment || !profile) return;
    setLoading(true);
    try {
      const payload = {
        ...apartmentWriteFields(apartment),
        ...copyListingTitles(apartment, t('owner.copySuffix')),
        photos,
        amenities,
      };
      const { data, error } = await supabase.from('apartments').insert(payload).select('id').single();
      if (error) throw error;
      alert(t('common.done'), t('owner.duplicated'));
      if (data?.id) router.replace({ pathname: '/(owner)/listing/[id]', params: { id: data.id } });
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const listingOwnerId = apartment?.owner_id || ownerId || (!asAdmin ? profile?.id : '');
    if (!profile || !listingOwnerId || !titleAr.trim() || !cityId || !price) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    const city = cities.find((item) => item.id === cityId);
    const university = universities.find((item) => item.id === universityId);
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
    };
    const resubmit =
      !asAdmin &&
      apartment &&
      (apartment.status === 'approved' || apartment.status === 'hidden' || apartment.status === 'rejected');
    setLoading(true);
    try {
      if (apartment) {
        const update = asAdmin
          ? { ...payload, status: listingStatus }
          : resubmit
            ? { ...payload, status: 'pending' as const, reject_reason: null }
            : payload;
        const { error } = await supabase.from('apartments').update(update).eq('id', apartment.id);
        if (error) throw error;
      } else if (asAdmin) {
        const { error } = await supabase.from('apartments').insert({ ...payload, status: listingStatus });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('apartments').insert(payload);
        if (error) throw error;
      }
      if (resubmit) {
        alert(t('common.done'), t('owner.sentForReview'), [
          { text: t('common.done'), onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  const setVisibility = (next: 'hidden' | 'approved') => {
    if (!apartment) return;
    const run = async () => {
      const { error } = await supabase.from('apartments').update({ status: next }).eq('id', apartment.id);
      if (error) alert(t('common.error'), error.message);
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
    <Screen back>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{apartment ? t('owner.editListing') : t('owner.addListing')}</Text>
      <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>{t('owner.addHint')}</Text>

      <Card>
        <SectionHead icon="images-outline" title={t('owner.photos')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('owner.photosHint')}</Text>
        {cover ? (
          <Pressable onPress={() => onPhotoPress(cover, 0)} style={styles.coverWrap}>
            <Image source={{ uri: cover }} style={[styles.cover, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" />
            <View style={[styles.coverBadge, isRtl ? styles.coverBadgeStart : styles.coverBadgeEnd, { backgroundColor: colors.primary }]}>
              <Text style={[styles.coverBadgeText, { color: colors.white }]}>{t('owner.coverPhoto')}</Text>
            </View>
          </Pressable>
        ) : null}
        <View style={[styles.photoGrid, chipAlign]}>
          {photos.slice(1).map((uri, index) => (
            <Pressable key={uri} onPress={() => onPhotoPress(uri, index + 1)} style={styles.photoWrap}>
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
        <SearchSelect
          label={t('owner.nearestUni')}
          value={universityId}
          placeholder={t('common.select')}
          options={universityOptions}
          onChange={setUniversityId}
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

      <Button title={t('common.save')} onPress={() => void save()} loading={loading} pill />
      {apartment && !asAdmin ? (
        <Button
          title={t('owner.preview')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/(owner)/apartment/[id]', params: { id: apartment.id } })}
          pill
        />
      ) : null}
      {apartment && !asAdmin ? (
        <Button title={t('owner.duplicate')} variant="secondary" onPress={() => void duplicateListing()} loading={loading} pill />
      ) : null}
      {apartment?.status === 'approved' ? (
        <Button title={t('owner.hideListing')} variant="secondary" onPress={() => setVisibility('hidden')} pill />
      ) : null}
      {apartment?.status === 'hidden' ? (
        <Button title={t('owner.unhideListing')} variant="secondary" onPress={() => setVisibility('approved')} pill />
      ) : null}
      {apartment ? (
        <Button title={t('owner.deleteListing')} variant="danger" onPress={removeListing} pill />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
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
