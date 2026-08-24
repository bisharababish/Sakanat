import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { formatKm, listingDistanceKm, mapsUrl } from '@/src/lib/distance';
import { formatIls, listingBadgeTone, localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Apartment, ListingStatus } from '@/src/types/database';

const PHOTO_WIDTH = Dimensions.get('window').width - spacing.lg * 2;

export default function AdminApartmentReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { rtlText, row, lang, alignStart } = useLayout();
  const { universities } = useCatalog();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email)')
      .eq('id', id)
      .single();
    setApartment((data as Apartment) ?? null);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const university = useMemo(
    () => universities.find((item) => item.id === apartment?.nearest_university_id) ?? apartment?.universities,
    [apartment, universities],
  );
  const distance = apartment ? listingDistanceKm(apartment, university) : null;
  const photos = apartment?.photos?.filter(Boolean) ?? [];

  const setStatus = async (status: ListingStatus) => {
    if (!apartment) return;
    setBusy(true);
    const { error } = await supabase.from('apartments').update({ status }).eq('id', apartment.id);
    setBusy(false);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  const removeListing = () => {
    if (!apartment) return;
    Alert.alert(t('admin.deleteListing'), t('admin.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', apartment.id);
          if (error) Alert.alert(t('common.error'), error.message);
          else router.back();
        },
      },
    ]);
  };

  if (!apartment) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.top, { alignItems: alignStart }]}>
          <BackButton />
        </View>
        <View style={styles.center}>
          {loaded ? (
            <Text style={[styles.muted, rtlText]}>{t('admin.noListings')}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.top, { alignItems: alignStart }]}>
        <BackButton />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {photos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {photos.map((uri) => (
              <Image key={uri} source={{ uri }} style={[styles.cover, { width: PHOTO_WIDTH }]} contentFit="cover" />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.coverFallback} />
        )}
        <StatusBadge label={t(`status.${apartment.status}`)} tone={listingBadgeTone(apartment.status)} />
        <Text style={[styles.title, rtlText]}>{localizedTitle(apartment, i18n.language)}</Text>
        <Text style={[styles.price, rtlText]}>
          {formatIls(apartment.price_month, lang)} / {t('common.perMonth')}
        </Text>
        <Text style={[styles.muted, rtlText]}>
          {localizedName(apartment.cities, i18n.language)} · {t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms })}
          {apartment.area_m2 ? ` · ${t('listing.area', { area: apartment.area_m2 })}` : ''}
        </Text>
        <StatusBadge label={t(`gender.${apartment.gender_policy}`)} tone="info" />
        {localizedDescription(apartment, i18n.language) ? (
          <Text style={[styles.body, rtlText]}>{localizedDescription(apartment, i18n.language)}</Text>
        ) : null}
        <Text style={[styles.section, rtlText]}>{t('listing.distance')}</Text>
        <Text style={[styles.body, rtlText]}>
          {university ? localizedName(university, i18n.language) : ''}
          {distance != null ? `\n${formatKm(distance, lang)}` : ''}
        </Text>
        <Button
          title={t('common.openMaps')}
          variant="ghost"
          onPress={() => Linking.openURL(mapsUrl(apartment.lat, apartment.lng, localizedTitle(apartment, i18n.language)))}
        />
        <Text style={[styles.section, rtlText]}>{t('listing.amenities')}</Text>
        {apartment.amenities.length === 0 ? (
          <Text style={[styles.muted, rtlText]}>{t('listing.noAmenities')}</Text>
        ) : (
          <View style={[styles.wrap, row]}>
            {apartment.amenities.map((item) => (
              <View key={item} style={styles.amenity}>
                <Text style={styles.amenityText}>{t(`amenities.${item}`)}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.section, rtlText]}>{t('listing.owner')}</Text>
        <Text style={[styles.body, rtlText]}>{apartment.profiles?.full_name}</Text>
        {apartment.profiles?.email ? <Text style={[styles.muted, rtlText]}>{apartment.profiles.email}</Text> : null}
        {apartment.profiles?.phone ? (
          <Button title={t('common.call')} variant="ghost" onPress={() => Linking.openURL(`tel:${apartment.profiles?.phone}`)} />
        ) : null}
        {apartment.status !== 'approved' ? (
          <Button title={t('admin.approve')} onPress={() => void setStatus('approved')} loading={busy} />
        ) : null}
        {apartment.status !== 'rejected' ? (
          <Button title={t('admin.reject')} variant="danger" onPress={() => void setStatus('rejected')} loading={busy} />
        ) : null}
        <Button title={t('admin.deleteListing')} variant="ghost" onPress={removeListing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 },
  cover: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  coverFallback: { width: '100%', height: 160, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  price: { fontSize: 20, fontWeight: '800', color: colors.primary },
  muted: { color: colors.textMuted },
  body: { fontSize: 16, color: colors.text, lineHeight: 24 },
  section: { marginTop: 8, fontWeight: '800', color: colors.text, fontSize: 16 },
  wrap: { flexWrap: 'wrap', gap: 8 },
  amenity: { backgroundColor: colors.primarySoft, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  amenityText: { color: colors.primaryDark, fontWeight: '700' },
});
