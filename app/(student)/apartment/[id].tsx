import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { formatKm, listingDistanceKm, mapsUrl } from '@/src/lib/distance';
import { formatIls, localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import { isStudentReady, listingFitsStudent } from '@/src/lib/studentProfile';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Apartment } from '@/src/types/database';

const PHOTO_WIDTH = Dimensions.get('window').width - spacing.lg * 2;

export default function ApartmentDetails() {
  const { id, universityId } = useLocalSearchParams<{ id: string; universityId?: string }>();
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, lang, isRtl } = useLayout();
  const { profile } = useAuth();
  const { universities } = useCatalog();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const copy = { textAlign, writingDirection };

  useEffect(() => {
    if (!id) return;
    supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setApartment(data as Apartment);
        else setMissing(true);
      });
  }, [id]);

  useEffect(() => {
    if (!id || !profile?.id) return;
    void loadSavedApartmentIds(profile.id)
      .then((ids) => setSaved(ids.includes(id)))
      .catch(() => undefined);
  }, [id, profile?.id]);

  const university = useMemo(
    () => universities.find((item) => item.id === (universityId || apartment?.nearest_university_id)) ?? apartment?.universities,
    [apartment, universities, universityId],
  );
  const distance = apartment ? listingDistanceKm(apartment, university) : null;
  const photos = apartment?.photos?.filter(Boolean) ?? [];
  const mismatch = Boolean(
    apartment && profile?.gender && !listingFitsStudent(apartment.gender_policy, profile.gender),
  );

  const onPhotosScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / PHOTO_WIDTH);
    if (next !== photoIndex) setPhotoIndex(next);
  };

  const startChat = async () => {
    if (!profile || !apartment) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(apartment, profile.id);
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: conversationId } });
    } finally {
      setBusy(false);
    }
  };

  const goBook = () => {
    if (!apartment) return;
    if (!isStudentReady(profile)) {
      alert(t('booking.needProfile'), t('profile.completeToBook'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.title'), onPress: () => router.push('/(student)/(tabs)/profile') },
      ]);
      return;
    }
    if (mismatch) {
      alert(t('common.error'), t('listing.genderMismatch'));
      return;
    }
    router.push({ pathname: '/(student)/book/[id]', params: { id: apartment.id } });
  };

  if (!apartment) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ChromeBar back compactBack />
        <View style={styles.center}>
          {missing ? <Text style={[styles.muted, copy]}>{t('listing.notFound')}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ChromeBar
        back
        compactBack
        extra={
          <Pressable
            onPress={async () => {
              if (!profile) return;
              setSaving(true);
              try {
                setSaved(await toggleSavedApartment(profile.id, apartment.id, saved));
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={saved ? t('listing.saved') : t('listing.save')}
            style={styles.heartBtn}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.danger : colors.primary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {photos.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPhotosScroll}
            >
              {photos.map((uri) => (
                <Image key={uri} source={{ uri }} style={[styles.cover, { width: PHOTO_WIDTH }]} contentFit="cover" />
              ))}
            </ScrollView>
            {photos.length > 1 ? (
              <Text style={styles.photoCount}>{t('listing.photoIndex', { current: photoIndex + 1, total: photos.length })}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.coverFallback} />
        )}

        <Text style={[styles.title, copy]}>{localizedTitle(apartment, i18n.language)}</Text>
        <Text style={[styles.price, copy]}>
          {formatIls(apartment.price_month, lang)} / {t('common.perMonth')}
        </Text>
        <View style={[styles.chips, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{localizedName(apartment.cities, i18n.language)}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms })}
            </Text>
          </View>
          {apartment.area_m2 ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{t('listing.area', { area: apartment.area_m2 })}</Text>
            </View>
          ) : null}
          <View style={[styles.chip, mismatch ? styles.chipWarn : null]}>
            <Text style={[styles.chipText, mismatch ? styles.chipWarnText : null]}>
              {t(`gender.${apartment.gender_policy}`)}
            </Text>
          </View>
        </View>
        {mismatch ? <Text style={[styles.warn, copy]}>{t('listing.genderMismatch')}</Text> : null}

        {localizedDescription(apartment, i18n.language) ? (
          <Card>
            <Text style={[styles.section, copy]}>{t('listing.details')}</Text>
            <Text style={[styles.body, copy]}>{localizedDescription(apartment, i18n.language)}</Text>
          </Card>
        ) : null}

        <Card>
          <Text style={[styles.section, copy]}>{t('listing.distance')}</Text>
          <Text style={[styles.body, copy]}>
            {university ? localizedName(university, i18n.language) : t('listing.location')}
            {distance != null ? `\n${formatKm(distance, lang)}` : ''}
          </Text>
          <Button
            title={t('common.openMaps')}
            variant="ghost"
            onPress={() => Linking.openURL(mapsUrl(apartment.lat, apartment.lng, localizedTitle(apartment, i18n.language)))}
          />
        </Card>

        <Card>
          <Text style={[styles.section, copy]}>{t('listing.amenities')}</Text>
          {apartment.amenities.length === 0 ? (
            <Text style={[styles.muted, copy]}>{t('listing.noAmenities')}</Text>
          ) : (
            <View style={[styles.chips, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
              {apartment.amenities.map((item) => (
                <View key={item} style={styles.chip}>
                  <Text style={styles.chipText}>{t(`amenities.${item}`)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card>
          <Text style={[styles.section, copy]}>{t('listing.owner')}</Text>
          <Text style={[styles.body, copy]}>{apartment.profiles?.full_name}</Text>
          {apartment.profiles?.phone ? (
            <Button
              title={t('common.call')}
              variant="ghost"
              onPress={() => Linking.openURL(`tel:${apartment.profiles?.phone}`)}
            />
          ) : null}
        </Card>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <View style={styles.action}>
            <Button title={t('listing.chat')} variant="secondary" onPress={() => void startChat()} loading={busy} pill />
          </View>
          <View style={styles.action}>
            <Button title={t('listing.book')} onPress={goBook} pill />
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  heartBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 24 },
  cover: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  coverFallback: { width: '100%', height: 160, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  photoCount: {
    position: 'absolute',
    end: 14,
    bottom: 12,
    backgroundColor: 'rgba(28, 36, 30, 0.72)',
    color: colors.white,
    overflow: 'hidden',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: 'Cairo_700Bold',
  },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  price: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.primary },
  muted: { color: colors.textMuted, fontFamily: 'Cairo_400Regular' },
  body: { fontSize: 16, color: colors.text, lineHeight: 24, fontFamily: 'Cairo_400Regular' },
  section: { fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipWarn: { backgroundColor: colors.dangerSoft },
  chipText: { color: colors.primaryDark, fontWeight: '700', fontFamily: 'Cairo_700Bold', fontSize: 13 },
  chipWarnText: { color: colors.danger },
  warn: { color: colors.danger, fontFamily: 'Cairo_600SemiBold', fontSize: 14 },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  actions: { gap: 8 },
  action: { flex: 1 },
});
