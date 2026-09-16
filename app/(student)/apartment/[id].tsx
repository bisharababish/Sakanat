import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApartmentView } from '@/components/ApartmentView';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/Button';
import { NoteModal } from '@/components/ui/NoteModal';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { trackEvent } from '@/src/lib/analytics';
import { openConversation } from '@/src/lib/chat';
import { listingDistanceKm } from '@/src/lib/distance';
import { requireAccount } from '@/src/lib/guest';
import { loadActiveStay, loadOccupiedStays, listingOccupiedStay, occupiedUntil, type OccupiedStay } from '@/src/lib/booking';
import { formatBookingDate, localizedTitle } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { submitAppReport } from '@/src/lib/reports';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import { loadPendingReview } from '@/src/lib/reviews';
import { similarNearCampus } from '@/src/lib/similarListings';
import { isStudentReady, listingFitsStudent, seekerProfileGapTab } from '@/src/lib/studentProfile';
import { OWNER_PUBLIC_PROFILE } from '@/src/lib/ownerPublic';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment } from '@/src/types/database';

export default function ApartmentDetails() {
  const { id, universityId, from, focus } = useLocalSearchParams<{
    id: string;
    universityId?: string;
    from?: string;
    focus?: string;
  }>();
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const { universities } = useCatalog();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [pool, setPool] = useState<Apartment[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportBody, setReportBody] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [activeStay, setActiveStay] = useState(false);
  const [occupiedStay, setOccupiedStay] = useState<OccupiedStay | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data }, { data: others }, review, stay, occupied] = await Promise.all([
      supabase
        .from('apartments')
        .select(`*, cities(*), universities(*), profiles!owner_id(${OWNER_PUBLIC_PROFILE})`)
        .eq('id', id)
        .single(),
      supabase
        .from('apartments')
        .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, id_verify_status)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(40),
      profile?.id ? loadPendingReview(profile.id) : Promise.resolve(null),
      profile?.id ? loadActiveStay(profile.id) : Promise.resolve(null),
      loadOccupiedStays(),
    ]);
    if (data) {
      setApartment(data as Apartment);
      setMissing(false);
    } else {
      setMissing(true);
    }
    const taken = new Set(occupied.map((item) => item.apartment_id));
    setOccupiedStay(listingOccupiedStay(id, occupied));
    setPool(((others as Apartment[]) ?? []).filter((item) => !taken.has(item.id)));
    setPendingReview(Boolean(review));
    setActiveStay(Boolean(stay));
    if (profile?.id) {
      try {
        const ids = await loadSavedApartmentIds(profile.id);
        setSaved(ids.includes(id));
      } catch {
        setSaved(false);
      }
    }
  }, [id, profile?.id]);

  const { refreshing, refresh } = useLiveReload(
    load,
    ['apartments', 'saved_apartments', 'bookings', 'apartment_reviews'],
    `apartment:${id ?? ''}`,
  );

  useEffect(() => {
    if (!apartment?.id) return;
    void trackEvent(
      'listing_view',
      { apartmentId: apartment.id, universityId: apartment.nearest_university_id },
      profile?.id,
    );
  }, [apartment?.id, apartment?.nearest_university_id, profile?.id]);

  const isRenter = profile?.role === 'renter';
  const useCity =
    isRenter || from === 'city' || (from !== 'campus' && !universityId && profile?.role !== 'student');
  const university = useMemo(
    () =>
      useCity
        ? null
        : universities.find(
            (item) => item.id === (universityId || profile?.university_id || apartment?.nearest_university_id),
          ) ??
          apartment?.universities ??
          null,
    [apartment, profile?.university_id, universities, universityId, useCity],
  );
  const distance = apartment
    ? listingDistanceKm(apartment, university, useCity ? apartment.cities : null)
    : null;
  const distancePlace = university ? ('campus' as const) : ('city' as const);
  const mismatch = Boolean(
    apartment && profile?.gender && !listingFitsStudent(apartment.gender_policy, profile.gender),
  );
  const bookGate = useMemo(() => {
    if (!apartment) return null;
    if (profile && !isStudentReady(profile)) {
      return { kind: 'profile' as const, title: t('booking.needProfile'), body: t('profile.completeToBook') };
    }
    if (profile && pendingReview) {
      return { kind: 'review' as const, title: t('review.neededTitle'), body: t('review.neededBody') };
    }
    if (profile && activeStay) {
      return { kind: 'stay' as const, title: t('booking.activeStayTitle'), body: t('booking.activeStayBody') };
    }
    if (occupiedStay) {
      return {
        kind: 'occupied' as const,
        title: t('booking.occupiedTitle'),
        body: t('booking.occupiedBody', { date: formatBookingDate(occupiedUntil(occupiedStay), i18n.language) }),
      };
    }
    if (mismatch) {
      return { kind: 'gender' as const, title: t('listing.genderMismatch'), body: t('listing.genderMismatchHint') };
    }
    return null;
  }, [activeStay, apartment, i18n.language, mismatch, occupiedStay, pendingReview, profile, t]);
  const similar = useMemo(
    () => (apartment ? similarNearCampus(apartment, pool, 4) : []),
    [apartment, pool],
  );

  const startChat = async () => {
    if (!profile) {
      requireAccount(apartment?.id);
      return;
    }
    if (!apartment) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(apartment, profile.id);
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: conversationId } });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === t('chat.blockedOpen')) {
        alert(t('common.error'), message, [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('chat.blockedManage'),
            onPress: () =>
              router.push({ pathname: '/(student)/(tabs)/profile', params: { tab: 'security' } }),
          },
        ]);
      } else if (message) {
        alert(t('common.error'), message);
      }
    } finally {
      setBusy(false);
    }
  };

  const goBook = () => {
    if (!apartment) return;
    if (bookGate?.kind === 'gender') {
      router.push('/(student)/(tabs)/search');
      return;
    }
    if (!profile) {
      requireAccount(apartment.id);
      return;
    }
    if (bookGate?.kind === 'profile') {
      router.push({
        pathname: '/(student)/(tabs)/profile',
        params: { resumeBook: apartment.id, tab: seekerProfileGapTab(profile) },
      });
      return;
    }
    if (bookGate?.kind === 'review' || bookGate?.kind === 'stay') {
      router.push('/(student)/(tabs)/bookings');
      return;
    }
    router.push({ pathname: '/(student)/book/[id]', params: { id: apartment.id } });
  };

  const sendListingReport = async () => {
    if (!profile || !apartment) return;
    if (reportBody.trim().length < 8) {
      alert(t('common.error'), t('listing.reportShort'));
      return;
    }
    setReportBusy(true);
    try {
      await submitAppReport(profile.id, {
        kind: 'safety',
        subject: t('listing.reportSubject', { title: localizedTitle(apartment, i18n.language) }),
        body: reportBody.trim(),
        targetApartmentId: apartment.id,
        targetUserId: apartment.owner_id,
      });
      setReporting(false);
      setReportBody('');
      alert(t('common.done'), t('listing.reportSent'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('listing.reportFailed'));
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <>
      <ApartmentView
        apartment={apartment}
        missing={missing}
        university={university}
        distance={distance}
        distancePlace={distancePlace}
        mismatch={mismatch}
        bookGate={bookGate}
        saved={saved}
        saving={saving}
        busy={busy}
        signedIn={Boolean(profile)}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        focusReviews={focus === 'reviews'}
        onRequireAccount={() => requireAccount(apartment?.id)}
        onToggleSave={() => {
          if (!profile) {
            requireAccount(apartment?.id);
            return;
          }
          if (!apartment) return;
          void (async () => {
            setSaving(true);
            try {
              setSaved(await toggleSavedApartment(profile.id, apartment.id, saved));
            } finally {
              setSaving(false);
            }
          })();
        }}
        onChat={() => void startChat()}
        onBook={goBook}
      >
        {profile ? (
          <Button title={t('listing.reportListing')} variant="ghost" compact pill onPress={() => setReporting(true)} />
        ) : null}
        {similar.length > 0 ? (
          <View style={styles.similar}>
            <Text style={[styles.similarTitle, rtlText, { color: colors.text }]}>
              {t(useCity ? 'listing.similarTitleCity' : 'listing.similarTitle')}
            </Text>
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('listing.similarHint')}</Text>
            {similar.map((item) => (
              <ListingCard
                key={item.id}
                apartment={item}
                ownerVerified={item.profiles?.id_verify_status === 'approved'}
                university={item.universities}
                distanceKm={listingDistanceKm(item, university, useCity ? item.cities : null)}
                onPress={() =>
                  router.push({
                    pathname: '/(student)/apartment/[id]',
                    params: {
                      id: item.id,
                      universityId: universityId || university?.id,
                      from,
                    },
                  })
                }
              />
            ))}
          </View>
        ) : null}
      </ApartmentView>
      <NoteModal
        visible={reporting}
        title={t('listing.reportTitle')}
        label={t('listing.reportDetails')}
        hint={t('listing.reportHint')}
        value={reportBody}
        confirmTitle={t('listing.reportListing')}
        loading={reportBusy}
        onChange={setReportBody}
        onConfirm={() => void sendListingReport()}
        onClose={() => setReporting(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  similar: { gap: spacing.sm },
  similarTitle: { fontSize: 18, fontFamily: 'Cairo_800ExtraBold' },
});
