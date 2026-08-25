import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
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
import { supabase } from '@/src/lib/supabase';
import { uploadApartmentPhoto } from '@/src/lib/upload';
import { colors, radius } from '@/src/theme/colors';
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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert(t('common.error'), t('owner.photoPermission'));
      return;
    }
    const remaining = Math.max(1, 12 - photos.length);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets.length) return;
    setLoading(true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        urls.push(await uploadApartmentPhoto(profile.id, asset.uri));
      }
      setPhotos((current) => [...current, ...urls].slice(0, 12));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (uri: string) => {
    alert(t('owner.removePhoto'), '', [
      { text: t('common.no'), style: 'cancel' },
      { text: t('common.yes'), style: 'destructive', onPress: () => setPhotos((current) => current.filter((item) => item !== uri)) },
    ]);
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
            ? { ...payload, status: 'pending' as const }
            : payload;
        const { error } = await supabase.from('apartments').update(update).eq('id', apartment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('apartments')
          .insert(asAdmin ? { ...payload, status: listingStatus } : payload);
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
      <Text style={[styles.title, rtlText]}>{apartment ? t('owner.editListing') : t('owner.addListing')}</Text>
      <Text style={[styles.sub, rtlText]}>{t('owner.addHint')}</Text>

      <Card>
        <SectionHead icon="images-outline" title={t('owner.photos')} />
        <Text style={[styles.hint, rtlText]}>{t('owner.photosHint')}</Text>
        {cover ? (
          <Pressable onPress={() => removePhoto(cover)} style={styles.coverWrap}>
            <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
            <View style={[styles.coverBadge, isRtl ? styles.coverBadgeStart : styles.coverBadgeEnd]}>
              <Text style={styles.coverBadgeText}>{t('owner.coverPhoto')}</Text>
            </View>
            <View style={styles.photoX}>
              <Ionicons name="close" size={14} color={colors.white} />
            </View>
          </Pressable>
        ) : null}
        <View style={[styles.photoGrid, chipAlign]}>
          {photos.slice(1).map((uri) => (
            <Pressable key={uri} onPress={() => removePhoto(uri)} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
              <View style={styles.photoX}>
                <Ionicons name="close" size={14} color={colors.white} />
              </View>
            </Pressable>
          ))}
          {photos.length < 12 ? (
            <Pressable onPress={() => void addPhoto()} style={styles.addTile} disabled={loading}>
              <Ionicons name="camera-outline" size={26} color={colors.primary} />
              <Text style={styles.addTileText}>{photos.length === 0 ? t('owner.addPhoto') : t('owner.addMorePhotos')}</Text>
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
        <Text style={[styles.label, rtlText]}>{t('owner.campusKm')}</Text>
        <View style={[styles.chips, chipAlign]}>
          {CAMPUS_KM_VALUES.map((km) => {
            const value = String(km);
            return (
              <Chip
                key={value}
                label={km === UNDER_ONE_KM ? t('common.under1km') : `${km} ${t('common.km')}`}
                selected={campusKm === value}
                onPress={() => setCampusKm((current) => (current === value ? '' : value))}
              />
            );
          })}
        </View>
      </Card>

      <Card>
        <SectionHead icon="home-outline" title={t('owner.detailsTitle')} />
        <Input label={t('common.price')} value={price} onChangeText={setPrice} keyboardType="numeric" />
        <Text style={[styles.label, rtlText]}>{t('common.rooms')}</Text>
        <View style={[styles.chips, chipAlign]}>
          {ROOM_COUNTS.map((value) => (
            <Chip key={value} label={value} selected={rooms === value} onPress={() => setRooms(value)} />
          ))}
        </View>
        <Text style={[styles.label, rtlText]}>{t('common.bathrooms')}</Text>
        <View style={[styles.chips, chipAlign]}>
          {BATH_COUNTS.map((value) => (
            <Chip key={value} label={value} selected={baths === value} onPress={() => setBaths(value)} />
          ))}
        </View>
        <Input label={t('owner.area')} value={area} onChangeText={setArea} keyboardType="numeric" />
      </Card>

      <Card>
        <SectionHead icon="people-outline" title={t('search.whoFor')} />
        <View style={[styles.chips, chipAlign]}>
          {(['any', 'female', 'male'] as GenderPolicy[]).map((value) => (
            <Chip key={value} label={t(`gender.${value}`)} selected={gender === value} onPress={() => setGender(value)} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionHead icon="star-outline" title={t('listing.amenities')} />
        <View style={[styles.chips, chipAlign]}>
          {AMENITIES.map((item) => (
            <Chip
              key={item}
              label={t(`amenities.${item}`)}
              selected={amenities.includes(item)}
              onPress={() => toggleAmenity(item)}
            />
          ))}
        </View>
      </Card>

      {asAdmin ? (
        <Card>
          <SectionHead icon="shield-checkmark-outline" title={t('admin.listingStatus')} />
          <View style={[styles.chips, chipAlign]}>
            {(['pending', 'approved', 'hidden', 'rejected'] as ListingStatus[]).map((value) => (
              <Chip
                key={value}
                label={t(`status.${value}`)}
                selected={listingStatus === value}
                onPress={() => setListingStatus(value)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {!asAdmin &&
      (apartment?.status === 'approved' || apartment?.status === 'hidden' || apartment?.status === 'rejected') ? (
        <Text style={[styles.note, rtlText]}>{t('owner.editNeedsReview')}</Text>
      ) : null}

      <Button title={t('common.save')} onPress={() => void save()} loading={loading} pill />
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
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  sub: { color: colors.textMuted, fontSize: 14, fontFamily: 'Cairo_400Regular', marginTop: -4, marginBottom: 4 },
  hint: { color: colors.textMuted, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  label: { fontWeight: '800', fontFamily: 'Cairo_700Bold', color: colors.text, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  coverWrap: { width: '100%', height: 196 },
  cover: { width: '100%', height: 196, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  coverBadge: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coverBadgeStart: { start: 10 },
  coverBadgeEnd: { end: 10 },
  coverBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  photoX: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileText: { color: colors.primary, fontSize: 11, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  note: { color: colors.warning, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
});
