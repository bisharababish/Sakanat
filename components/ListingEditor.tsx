import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { uploadApartmentPhoto } from '@/src/lib/upload';
import { colors } from '@/src/theme/colors';
import { AMENITIES, type Apartment, type GenderPolicy } from '@/src/types/database';

type Props = {
  apartment?: Apartment | null;
};

export function ListingEditor({ apartment }: Props) {
  const { t, i18n } = useTranslation();
  const { textAlign, row } = useLayout();
  const { profile } = useAuth();
  const { cities, universities } = useCatalog();
  const [titleAr, setTitleAr] = useState(apartment?.title_ar ?? '');
  const [titleEn, setTitleEn] = useState(apartment?.title_en ?? '');
  const [descAr, setDescAr] = useState(apartment?.description_ar ?? '');
  const [descEn, setDescEn] = useState(apartment?.description_en ?? '');
  const [cityId, setCityId] = useState(apartment?.city_id ?? '');
  const [universityId, setUniversityId] = useState(apartment?.nearest_university_id ?? '');
  const [price, setPrice] = useState(apartment ? String(apartment.price_month) : '');
  const [rooms, setRooms] = useState(apartment ? String(apartment.rooms) : '1');
  const [baths, setBaths] = useState(apartment ? String(apartment.bathrooms) : '1');
  const [area, setArea] = useState(apartment?.area_m2 ? String(apartment.area_m2) : '');
  const [campusKm, setCampusKm] = useState(apartment?.campus_distance_km != null ? String(apartment.campus_distance_km) : '');
  const [gender, setGender] = useState<GenderPolicy>(apartment?.gender_policy ?? 'any');
  const [amenities, setAmenities] = useState<string[]>(apartment?.amenities ?? []);
  const [photos, setPhotos] = useState<string[]>(apartment?.photos ?? []);
  const [loading, setLoading] = useState(false);

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const universityOptions = useMemo(
    () => universities.map((item) => ({ value: item.id, label: localizedName(item, i18n.language) })),
    [universities, i18n.language],
  );

  const toggleAmenity = (key: string) => {
    setAmenities((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const addPhoto = async () => {
    if (!profile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setLoading(true);
    try {
      const url = await uploadApartmentPhoto(profile.id, result.assets[0].uri);
      setPhotos((current) => [...current, url]);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!profile || !titleAr || !cityId || !price) {
      Alert.alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    const city = cities.find((item) => item.id === cityId);
    const university = universities.find((item) => item.id === universityId);
    const payload = {
      owner_id: profile.id,
      city_id: cityId,
      nearest_university_id: universityId || null,
      title_ar: titleAr,
      title_en: titleEn || titleAr,
      description_ar: descAr,
      description_en: descEn || descAr,
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
    setLoading(true);
    try {
      if (apartment) {
        const { error } = await supabase.from('apartments').update(payload).eq('id', apartment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('apartments').insert(payload);
        if (error) throw error;
      }
      router.back();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{apartment ? t('owner.editListing') : t('owner.addListing')}</Text>
      <Input label={t('owner.titleAr')} value={titleAr} onChangeText={setTitleAr} />
      <Input label={t('owner.titleEn')} value={titleEn} onChangeText={setTitleEn} />
      <Input label={t('owner.descAr')} value={descAr} onChangeText={setDescAr} multiline />
      <Input label={t('owner.descEn')} value={descEn} onChangeText={setDescEn} multiline />
      <Select label={t('common.city')} value={cityId} placeholder={t('common.select')} options={cityOptions} onChange={setCityId} />
      <Select
        label={t('owner.nearestUni')}
        value={universityId}
        placeholder={t('common.select')}
        options={universityOptions}
        onChange={setUniversityId}
      />
      <Input label={t('common.price')} value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Input label={t('common.rooms')} value={rooms} onChangeText={setRooms} keyboardType="numeric" />
      <Input label="Bathrooms" value={baths} onChangeText={setBaths} keyboardType="numeric" />
      <Input label={t('owner.campusKm')} value={campusKm} onChangeText={setCampusKm} keyboardType="numeric" />
      <Input label="m²" value={area} onChangeText={setArea} keyboardType="numeric" />
      <Text style={[styles.label, { textAlign }]}>{t('gender.any')}</Text>
      <View style={[styles.row, row]}>
        {(['any', 'female', 'male'] as GenderPolicy[]).map((value) => (
          <Chip key={value} label={t(`gender.${value}`)} selected={gender === value} onPress={() => setGender(value)} />
        ))}
      </View>
      <Text style={[styles.label, { textAlign }]}>{t('listing.amenities')}</Text>
      <View style={[styles.row, row]}>
        {AMENITIES.map((item) => (
          <Chip key={item} label={t(`amenities.${item}`)} selected={amenities.includes(item)} onPress={() => toggleAmenity(item)} />
        ))}
      </View>
      <Text style={[styles.label, { textAlign }]}>{t('owner.photos')}</Text>
      <View style={[styles.row, row]}>
        {photos.map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.thumb} />
        ))}
      </View>
      <Button title={t('owner.addPhoto')} variant="secondary" onPress={addPhoto} loading={loading} />
      <Button title={t('common.save')} onPress={save} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  label: { fontWeight: '800', color: colors.text },
  row: { flexWrap: 'wrap', gap: 8 },
  thumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: colors.surfaceMuted },
});
