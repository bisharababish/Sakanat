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
import { ListingReviews } from '@/components/reviews/ListingReviews';
import { StarRow } from '@/components/reviews/StarRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { MAX_OCCUPANTS } from '@/src/lib/booking';
import { formatKm, mapsUrl, type DistancePlace } from '@/src/lib/distance';
import { formatIls, localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { listingShareUrl } from '@/src/lib/pushRouting';
import { whatsappLink } from '@/src/lib/phone';
import { loadApartmentReviews } from '@/src/lib/reviews';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, ApartmentReview, University } from '@/src/types/database';

const PHOTO_WIDTH = Dimensions.get('window').width - spacing.lg * 2;

export type ListingBookGate = {
  kind: 'profile' | 'review' | 'stay' | 'gender';
  title: string;
  body: string;
};

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
  asAdmin,
  onToggleSave,
  onChat,
  onBook,
  bookGate = null,
  onRequireAccount,
  children,
  refreshing = false,
  onRefresh,
  focusReviews = false,
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
  asAdmin?: boolean;
  onToggleSave?: () => void;
  onChat?: () => void;
  onBook?: () => void;
  bookGate?: ListingBookGate | null;
  onRequireAccount?: () => void;
  children?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  focusReviews?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { textAlign, writingDirection, lang, isRtl, row } = useLayout();
  const { profile } = useAuth();
  const colors = useColors();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [reviews, setReviews] = useState<ApartmentReview[]>([]);
  const [amenityOpen, setAmenityOpen] = useState(false);
  const carouselRef = useRef<ScrollView>(null);
  const pageScrollRef = useRef<ScrollView>(null);
  const reviewsY = useRef(0);
  const wasViewer = useRef(false);
  const copy = { textAlign, writingDirection };
  const photos = apartment?.photos?.filter(Boolean) ?? [];

  useEffect(() => {
    if (!apartment?.id) {
      setReviews([]);
      return;
    }
    let active = true;
    void loadApartmentReviews(apartment.id)
      .then((next) => {
        if (active) setReviews(next);
      })
      .catch(() => {
        if (active) setReviews([]);
      });
    return () => {
      active = false;
    };
  }, [apartment?.id]);

  useEffect(() => {
    if (wasViewer.current && !viewer) {
      carouselRef.current?.scrollTo({ x: photoIndex * PHOTO_WIDTH, animated: false });
    }
    wasViewer.current = viewer;
  }, [viewer, photoIndex]);

  useEffect(() => {
    if (!focusReviews || !apartment?.id) return;
    const timer = setTimeout(() => {
      pageScrollRef.current?.scrollTo({ y: Math.max(0, reviewsY.current - 12), animated: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [focusReviews, apartment?.id, reviews.length]);

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
      const link = listingShareUrl(apartment.id);
      await Share.share({
        message: t('listing.shareMessage', {
          title: localizedTitle(apartment, i18n.language),
          city: city || t('listing.location'),
          price: formatIls(apartment.price_month, lang),
          name: t('appName'),
          link,
        }),
        url: link,
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
        ref={pageScrollRef}
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
          {(apartment.review_count ?? reviews.length) > 0 ? (
            <View style={[styles.fact, { backgroundColor: colors.surfaceMuted }]}>
              <StarRow value={apartment.review_avg ?? 0} size={13} />
              <Text style={[styles.factText, { color: colors.text }]}>
                {(apartment.review_avg ?? 0).toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
        {mismatch && !preview && !bookGate ? (
          <Text style={[styles.warn, copy, { color: colors.danger }]}>{t('listing.genderMismatch')}</Text>
        ) : null}

        {localizedDescription(apartment, i18n.language) ? (
          <Card>
            <SectionHead icon="document-text-outline" title={t('listing.details')} />
            <Text style={[styles.body, copy, { color: colors.text }]}>{localizedDescription(apartment, i18n.language)}</Text>
          </Card>
        ) : null}

        <Card>
          <View style={[styles.mapsRow, row]}>
            <Ionicons
              name={distancePlace === 'city' ? 'location-outline' : 'school-outline'}
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.mapsCopy, copy, { color: colors.text }]} numberOfLines={2}>
              {distancePlace === 'city'
                ? city || t('listing.location')
                : university
                  ? localizedName(university, i18n.language)
                  : t('listing.location')}
              {distance != null ? ` · ${formatKm(distance, lang, distancePlace)}` : ''}
            </Text>
            <Button
              title={t('common.openMaps')}
              variant="ghost"
              compact
              pill
              onPress={() => Linking.openURL(mapsUrl(apartment.lat, apartment.lng, localizedTitle(apartment, i18n.language)))}
            />
          </View>
        </Card>

        <Card>
          <SectionHead icon="sparkles-outline" title={t('listing.amenities')} />
          {apartment.amenities.length === 0 ? (
            <Text style={[styles.muted, copy, { color: colors.textMuted }]}>{t('listing.noAmenities')}</Text>
          ) : (
            <>
              <View style={[styles.facts, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
                {(amenityOpen ? apartment.amenities : apartment.amenities.slice(0, 4)).map((item) => (
                  <View key={item} style={[styles.fact, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.factText, { color: colors.primaryDark }]}>{t(`amenities.${item}`)}</Text>
                  </View>
                ))}
              </View>
              {apartment.amenities.length > 4 ? (
                <Button
                  title={amenityOpen ? t('listing.hideAmenities') : t('listing.moreAmenities', { count: apartment.amenities.length - 4 })}
                  variant="ghost"
                  compact
                  pill
                  onPress={() => setAmenityOpen((open) => !open)}
                />
              ) : null}
            </>
          )}
        </Card>

        <Card>
          <SectionHead icon="person-outline" title={t('listing.owner')} />
          <Text style={[styles.body, copy, { color: colors.text }]}>
            {apartment.profiles?.full_name || t('listing.owner')}
          </Text>
          {apartment.profiles?.id_verify_status === 'approved' ? (
            <Text style={[styles.muted, copy, { color: colors.primary }]}>{t('listing.verifiedOwner')}</Text>
          ) : null}
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
        <View
          onLayout={(event) => {
            reviewsY.current = event.nativeEvent.layout.y;
          }}
        >
          <ListingReviews
            reviews={reviews}
            average={apartment.review_avg}
            count={apartment.review_count}
            asAdmin={asAdmin}
            ownerApartmentIds={
              profile?.role === 'owner' && profile.id === apartment.owner_id ? [apartment.id] : undefined
            }
            onChanged={() => {
              if (!apartment?.id) return;
              void loadApartmentReviews(apartment.id).then(setReviews).catch(() => setReviews([]));
              onRefresh?.();
            }}
          />
        </View>
        {children}
      </ScrollView>

      <PhotoViewer
        photos={photos}
        index={photoIndex}
        visible={viewer}
        onIndexChange={setPhotoIndex}
        onClose={() => setViewer(false)}
      />

      {preview ? null : (
        <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {bookGate ? (
            <Pressable
              onPress={bookGate.kind === 'gender' ? undefined : onBook}
              disabled={bookGate.kind === 'gender'}
              style={[
                styles.gate,
                row,
                {
                  backgroundColor: bookGate.kind === 'gender' ? colors.dangerSoft : colors.warningSoft,
                  borderColor: bookGate.kind === 'gender' ? colors.danger : colors.warning,
                },
              ]}
            >
              <Ionicons
                name={
                  bookGate.kind === 'profile'
                    ? 'person-outline'
                    : bookGate.kind === 'review'
                      ? 'star-outline'
                      : bookGate.kind === 'stay'
                        ? 'home-outline'
                        : 'warning-outline'
                }
                size={18}
                color={bookGate.kind === 'gender' ? colors.danger : colors.warning}
              />
              <View style={styles.gateCopy}>
                <Text
                  style={[
                    styles.gateTitle,
                    copy,
                    { color: bookGate.kind === 'gender' ? colors.danger : colors.text },
                  ]}
                >
                  {bookGate.title}
                </Text>
                <Text style={[styles.gateBody, copy, { color: colors.textMuted }]}>{bookGate.body}</Text>
              </View>
              {bookGate.kind === 'gender' ? null : (
                <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.warning} />
              )}
            </Pressable>
          ) : null}
          <View style={styles.footerPriceRow}>
            <Text style={[styles.footerPrice, { color: colors.primary }]}>{formatIls(apartment.price_month, lang)}</Text>
            <Text style={[styles.footerPer, { color: colors.textMuted }]}>/ {t('common.perMonth')}</Text>
          </View>
          <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <View style={styles.action}>
              <Button
                title={signedIn ? t('listing.chat') : t('listing.chatGuest')}
                variant="secondary"
                onPress={onChat}
                loading={busy}
                pill
              />
            </View>
            <View style={styles.action}>
              <Button
                title={
                  !signedIn
                    ? t('listing.bookGuest')
                    : bookGate?.kind === 'profile'
                      ? t('booking.needProfile')
                      : bookGate?.kind === 'review'
                        ? t('review.goWrite')
                        : bookGate?.kind === 'stay'
                          ? t('booking.myBookings')
                          : t('listing.book')
                }
                onPress={onBook}
                pill
                disabled={bookGate?.kind === 'gender'}
              />
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
  cover: { height: 188 },
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
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
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
  mapsRow: { alignItems: 'center', gap: 8 },
  mapsCopy: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  warn: { fontFamily: 'Cairo_600SemiBold', fontSize: 14 },
  gate: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  gateCopy: { flex: 1, minWidth: 0, gap: 2 },
  gateTitle: { fontSize: 13, fontFamily: 'Cairo_800ExtraBold' },
  gateBody: { fontSize: 12, lineHeight: 16, fontFamily: 'Cairo_400Regular' },
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
