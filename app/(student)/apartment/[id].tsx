import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
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

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { formatKm, listingDistanceKm, mapsUrl } from '@/src/lib/distance';
import { formatIls, localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { requireAccount } from '@/src/lib/guest';
import { alert } from '@/src/lib/notice';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import { isStudentReady, listingFitsStudent } from '@/src/lib/studentProfile';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment } from '@/src/types/database';

const PHOTO_WIDTH = Dimensions.get('window').width - spacing.lg * 2;

function Fact({
  icon,
  text,
  warn,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  warn?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.fact, { backgroundColor: warn ? colors.dangerSoft : colors.surfaceMuted }]}>
      <Ionicons name={icon} size={14} color={warn ? colors.danger : colors.primary} />
      <Text style={[styles.factText, { color: warn ? colors.danger : colors.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export default function ApartmentDetails() {
  const { id, universityId } = useLocalSearchParams<{ id: string; universityId?: string }>();
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, lang, isRtl } = useLayout();
  const colors = useColors();
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
    if (!profile) {
      requireAccount();
      return;
    }
    if (!apartment) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(apartment, profile.id);
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: conversationId } });
    } finally {
      setBusy(false);
    }
  };

  const goBook = () => {
    if (!profile) {
      requireAccount();
      return;
    }
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
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <ChromeBar back compactBack />
        <View style={styles.center}>
          {missing ? (
            <Text style={[styles.muted, copy, { color: colors.textMuted }]}>{t('listing.notFound')}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const city = localizedName(apartment.cities, i18n.language);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ChromeBar
        back
        compactBack
        extra={
          <Pressable
            onPress={() => {
              if (!profile) {
                requireAccount();
                return;
              }
              void (async () => {
                setSaving(true);
                try {
                  setSaved(await toggleSavedApartment(profile.id, apartment.id, saved));
                } finally {
                  setSaving(false);
                }
              })();
            }}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={saved ? t('listing.saved') : t('listing.save')}
            style={[styles.heartBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.danger : colors.primary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPhotosScroll}
            >
              {photos.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={[styles.cover, { width: PHOTO_WIDTH, backgroundColor: colors.surfaceMuted }]}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.cover, styles.coverFallback, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="home" size={40} color={colors.primary} />
            </View>
          )}
          <View style={[styles.pricePill, isRtl ? styles.pillStart : styles.pillEnd, { backgroundColor: colors.primary }]}>
            <Text style={[styles.pricePillText, { color: colors.white }]}>
              {formatIls(apartment.price_month, lang)} / {t('common.perMonth')}
            </Text>
          </View>
          {photos.length > 1 ? (
            <View style={styles.dots}>
              {photos.map((uri, index) => (
                <View
                  key={uri}
                  style={[
                    styles.dot,
                    { backgroundColor: index === photoIndex ? colors.white : 'rgba(255,255,255,0.45)' },
                    index === photoIndex && styles.dotOn,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <Text style={[styles.title, copy, { color: colors.text }]}>{localizedTitle(apartment, i18n.language)}</Text>
        {city ? (
          <View style={[styles.cityRow, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={[styles.city, copy, { color: colors.textMuted }]}>{city}</Text>
          </View>
        ) : null}

        <View style={[styles.facts, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
          <Fact icon="bed-outline" text={t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms })} />
          {apartment.area_m2 ? <Fact icon="resize-outline" text={t('listing.area', { area: apartment.area_m2 })} /> : null}
          <Fact icon="people-outline" text={t(`gender.${apartment.gender_policy}`)} warn={mismatch} />
          {distance != null ? <Fact icon="navigate-outline" text={formatKm(distance, lang)} /> : null}
        </View>
        {mismatch ? (
          <Text style={[styles.warn, copy, { color: colors.danger }]}>{t('listing.genderMismatch')}</Text>
        ) : null}

        {localizedDescription(apartment, i18n.language) ? (
          <Card>
            <SectionHead icon="document-text-outline" title={t('listing.details')} />
            <Text style={[styles.body, copy, { color: colors.text }]}>{localizedDescription(apartment, i18n.language)}</Text>
          </Card>
        ) : null}

        <Card>
          <SectionHead icon="school-outline" title={t('listing.distance')} />
          <Text style={[styles.body, copy, { color: colors.text }]}>
            {university ? localizedName(university, i18n.language) : t('listing.location')}
            {distance != null ? `\n${formatKm(distance, lang)}` : ''}
          </Text>
          <Button
            title={t('common.openMaps')}
            variant="ghost"
            pill
            onPress={() => Linking.openURL(mapsUrl(apartment.lat, apartment.lng, localizedTitle(apartment, i18n.language)))}
          />
        </Card>

        <Card>
          <SectionHead icon="sparkles-outline" title={t('listing.amenities')} />
          {apartment.amenities.length === 0 ? (
            <Text style={[styles.muted, copy, { color: colors.textMuted }]}>{t('listing.noAmenities')}</Text>
          ) : (
            <View style={[styles.facts, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
              {apartment.amenities.map((item) => (
                <View key={item} style={[styles.fact, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.factText, { color: colors.primaryDark }]}>{t(`amenities.${item}`)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card>
          <SectionHead icon="person-outline" title={t('listing.owner')} />
          <Text style={[styles.body, copy, { color: colors.text }]}>{apartment.profiles?.full_name}</Text>
          {profile && apartment.profiles?.phone ? (
            <Button
              title={t('common.call')}
              variant="ghost"
              pill
              onPress={() => Linking.openURL(`tel:${apartment.profiles?.phone}`)}
            />
          ) : !profile ? (
            <Button title={t('common.call')} variant="ghost" pill onPress={requireAccount} />
          ) : null}
        </Card>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
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
  safe: { flex: 1 },
  heartBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 24 },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cover: { height: 240 },
  coverFallback: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  pricePill: {
    position: 'absolute',
    top: 14,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillStart: { start: 14 },
  pillEnd: { end: 14 },
  pricePillText: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 16 },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8 },
  city: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  muted: { fontFamily: 'Cairo_400Regular' },
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'Cairo_400Regular' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  factText: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  warn: { fontFamily: 'Cairo_600SemiBold', fontSize: 14 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  actions: { gap: 8 },
  action: { flex: 1 },
});
