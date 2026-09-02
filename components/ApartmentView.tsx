import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { useLayout } from '@/src/hooks/useLayout';
import { MAX_OCCUPANTS } from '@/src/lib/booking';
import { formatKm, mapsUrl, type DistancePlace } from '@/src/lib/distance';
import { formatIls, localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { whatsappLink } from '@/src/lib/phone';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, University } from '@/src/types/database';

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

export function ApartmentView({
  apartment,
  missing,
  university,
  distance,
  distancePlace = 'campus',
  mismatch,
  preview,
  saved,
  saving,
  busy,
  signedIn,
  onToggleSave,
  onChat,
  onBook,
  onRequireAccount,
  children,
  refreshing = false,
  onRefresh,
}: {
  apartment: Apartment | null;
  missing?: boolean;
  university?: University | null;
  distance?: number | null;
  distancePlace?: DistancePlace;
  mismatch?: boolean;
  preview?: boolean;
  saved?: boolean;
  saving?: boolean;
  busy?: boolean;
  signedIn?: boolean;
  onToggleSave?: () => void;
  onChat?: () => void;
  onBook?: () => void;
  onRequireAccount?: () => void;
  children?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, lang, isRtl } = useLayout();
  const colors = useColors();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const carouselRef = useRef<ScrollView>(null);
  const wasViewer = useRef(false);
  const copy = { textAlign, writingDirection };
  const photos = apartment?.photos?.filter(Boolean) ?? [];

  useEffect(() => {
    if (wasViewer.current && !viewer) {
      carouselRef.current?.scrollTo({ x: photoIndex * PHOTO_WIDTH, animated: false });
    }
    wasViewer.current = viewer;
  }, [viewer, photoIndex]);

  const onPhotosScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / PHOTO_WIDTH);
    if (next !== photoIndex) setPhotoIndex(next);
  };

  const openPhoto = (next: number) => {
    setPhotoIndex(next);
    setViewer(true);
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
  const shareListing = async () => {
    try {
      await Share.share({
        message: t('listing.shareMessage', {
          title: localizedTitle(apartment, i18n.language),
          city: city || t('listing.location'),
          price: formatIls(apartment.price_month, lang),
          name: t('appName'),
        }),
      });
    } catch {
      // user dismissed the sheet
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ChromeBar
        back
        compactBack
        extra={
          <>
            <Pressable
              onPress={() => void shareListing()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('listing.share')}
              style={[styles.heartBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="share-outline" size={20} color={colors.primary} />
            </Pressable>
            {preview || !onToggleSave ? null : (
              <Pressable
                onPress={onToggleSave}
                disabled={saving}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={saved ? t('listing.saved') : t('listing.save')}
                style={[styles.heartBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? colors.danger : colors.primary} />
              </Pressable>
            )}
          </>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        bounces
        alwaysBounceVertical={Boolean(onRefresh)}
        overScrollMode={onRefresh ? 'always' : 'auto'}
        nestedScrollEnabled
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          ) : undefined
        }
      >
        {preview ? (
          <View style={[styles.previewBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Ionicons name="eye-outline" size={18} color={colors.primaryDark} />
            <Text style={[styles.previewText, copy, { color: colors.primaryDark }]}>{t('owner.previewHint')}</Text>
          </View>
        ) : null}

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.text }]}>
          {photos.length > 0 ? (
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              style={styles.ltr}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPhotosScroll}
            >
              {photos.map((uri, index) => (
                <Pressable
                  key={uri}
                  onPress={() => openPhoto(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('listing.viewPhoto')}
                >
                  <Image
                    source={{ uri }}
                    style={[styles.cover, { width: PHOTO_WIDTH, backgroundColor: colors.surfaceMuted }]}
                    contentFit="cover"
                  />
                </Pressable>
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
          {photos.length > 0 ? (
            <View
              style={[
                styles.countPill,
                isRtl ? styles.pillEnd : styles.pillStart,
                { backgroundColor: 'rgba(28, 36, 30, 0.72)' },
              ]}
            >
              <Text style={[styles.pricePillText, { color: colors.white }]}>
                {t('listing.photoIndex', { current: photoIndex + 1, total: photos.length })}
              </Text>
            </View>
          ) : null}
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
          <Fact icon="people-circle-outline" text={t('listing.fitsPeople', { count: MAX_OCCUPANTS })} />
          <Fact icon="people-outline" text={t(`gender.${apartment.gender_policy}`)} warn={mismatch} />
          {distance != null ? <Fact icon="navigate-outline" text={formatKm(distance, lang, distancePlace)} /> : null}
        </View>
        {mismatch && !preview ? (
          <Text style={[styles.warn, copy, { color: colors.danger }]}>{t('listing.genderMismatch')}</Text>
        ) : null}

        {localizedDescription(apartment, i18n.language) ? (
          <Card>
            <SectionHead icon="document-text-outline" title={t('listing.details')} />
            <Text style={[styles.body, copy, { color: colors.text }]}>{localizedDescription(apartment, i18n.language)}</Text>
          </Card>
        ) : null}

        <Card>
          <SectionHead
            icon={distancePlace === 'city' ? 'location-outline' : 'school-outline'}
            title={distancePlace === 'city' ? t('listing.distanceCity') : t('listing.distance')}
          />
          <Text style={[styles.body, copy, { color: colors.text }]}>
            {distancePlace === 'city'
              ? city || t('listing.location')
              : university
                ? localizedName(university, i18n.language)
                : t('listing.location')}
            {distance != null ? `\n${formatKm(distance, lang, distancePlace)}` : ''}
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
          <Text style={[styles.body, copy, { color: colors.text }]}>
            {apartment.profiles?.full_name || t('listing.owner')}
          </Text>
          {preview && signedIn && apartment.profiles?.phone ? (
            <Button
              title={t('common.call')}
              variant="ghost"
              pill
              onPress={() => Linking.openURL(`tel:${apartment.profiles?.phone}`)}
            />
          ) : null}
          {preview && signedIn && (apartment.profiles?.whatsapp || apartment.profiles?.phone) ? (
            <Button
              title={t('profile.openWhatsapp')}
              variant="ghost"
              pill
              onPress={() =>
                Linking.openURL(whatsappLink(apartment.profiles?.whatsapp || apartment.profiles?.phone || ''))
              }
            />
          ) : null}
        </Card>
        {children}
      </ScrollView>

      <PhotoViewer
        photos={photos}
        index={photoIndex}
        visible={viewer}
        onIndexChange={setPhotoIndex}
        onClose={() => setViewer(false)}
      />

      {preview || children ? null : (
        <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.footerPriceRow}>
            <Text style={[styles.footerPrice, { color: colors.primary }]}>{formatIls(apartment.price_month, lang)}</Text>
            <Text style={[styles.footerPer, { color: colors.textMuted }]}>/ {t('common.perMonth')}</Text>
          </View>
          <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <View style={styles.action}>
              <Button title={t('listing.chat')} variant="secondary" onPress={onChat} loading={busy} pill />
            </View>
            <View style={styles.action}>
              <Button title={t('listing.book')} onPress={onBook} pill disabled={mismatch} />
            </View>
          </View>
        </SafeAreaView>
      )}
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
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewText: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
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
  ltr: { direction: 'ltr' },
  pricePill: {
    position: 'absolute',
    top: 14,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countPill: {
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
  footerPriceRow: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  footerPrice: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  footerPer: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  actions: { gap: 8 },
  action: { flex: 1 },
});
