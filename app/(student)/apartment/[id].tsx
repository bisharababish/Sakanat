import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApartmentView } from '@/components/ApartmentView';
import { ListingCard } from '@/components/ListingCard';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoteModal } from '@/components/ui/NoteModal';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { trackEvent } from '@/src/lib/analytics';
import { openConversation } from '@/src/lib/chat';
import { listingDistanceKm } from '@/src/lib/distance';
import { localizedTitle } from '@/src/lib/format';
import { requireAccount } from '@/src/lib/guest';
import { loadActiveStay } from '@/src/lib/booking';
import { alert } from '@/src/lib/notice';
import { submitAppReport } from '@/src/lib/reports';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import { loadPendingReview } from '@/src/lib/reviews';
import { similarNearCampus } from '@/src/lib/similarListings';
import { isStudentReady, listingFitsStudent, seekerProfileGapTab } from '@/src/lib/studentProfile';
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

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data }, { data: others }] = await Promise.all([
      supabase
        .from('apartments')
        .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, id_verify_status)')
        .eq('id', id)
        .single(),
      supabase
        .from('apartments')
        .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, id_verify_status)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(40),
    ]);
    if (data) {
      setApartment(data as Apartment);
      setMissing(false);
    } else {
      setMissing(true);
    }
    setPool((others as Apartment[]) ?? []);
    if (profile?.id) {
      try {
        const ids = await loadSavedApartmentIds(profile.id);
        setSaved(ids.includes(id));
      } catch {
        setSaved(false);
      }
    }
  }, [id, profile?.id]);

  const { refreshing, refresh } = useLiveReload(load, ['apartments', 'saved_apartments'], `apartment:${id ?? ''}`);

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
  const similar = useMemo(
    () => (apartment ? similarNearCampus(apartment, pool, 4) : []),
    [apartment, pool],
  );

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
        {
          text: t('profile.title'),
          onPress: () =>
            router.push({
              pathname: '/(student)/(tabs)/profile',
              params: { resumeBook: apartment.id, tab: seekerProfileGapTab(profile) },
            }),
        },
      ]);
      return;
    }
    void Promise.all([loadPendingReview(profile.id), loadActiveStay(profile.id)]).then(
      ([pendingReview, activeStay]) => {
        if (pendingReview) {
          alert(t('review.neededTitle'), t('review.neededBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('review.goWrite'), onPress: () => router.push('/(student)/(tabs)/bookings') },
          ]);
          return;
        }
        if (activeStay) {
          alert(t('booking.activeStayTitle'), t('booking.activeStayBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('booking.myBookings'),
              onPress: () => router.push('/(student)/(tabs)/bookings'),
            },
          ]);
          return;
        }
        if (mismatch) {
          alert(t('common.error'), t('listing.genderMismatch'));
          return;
        }
        router.push({ pathname: '/(student)/book/[id]', params: { id: apartment.id } });
      },
    );
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
        saved={saved}
        saving={saving}
        busy={busy}
        signedIn={Boolean(profile)}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        focusReviews={focus === 'reviews'}
        onRequireAccount={requireAccount}
        onToggleSave={() => {
          if (!profile) {
            requireAccount();
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
          <Card>
            <SectionHead icon="flag-outline" title={t('listing.reportTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('listing.reportHint')}</Text>
            <Button title={t('listing.reportListing')} variant="danger" pill onPress={() => setReporting(true)} />
          </Card>
        ) : null}
        {similar.length > 0 ? (
          <View style={styles.similar}>
            <Text style={[styles.similarTitle, rtlText, { color: colors.text }]}>{t('listing.similarTitle')}</Text>
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
