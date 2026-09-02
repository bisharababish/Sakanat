import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApartmentView } from '@/components/ApartmentView';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { listingDistanceKm } from '@/src/lib/distance';
import { requireAccount } from '@/src/lib/guest';
import { alert } from '@/src/lib/notice';
import { loadSavedApartmentIds, toggleSavedApartment } from '@/src/lib/saved';
import { isStudentReady, listingFitsStudent } from '@/src/lib/studentProfile';
import { supabase } from '@/src/lib/supabase';
import type { Apartment } from '@/src/types/database';

export default function ApartmentDetails() {
  const { id, universityId, from } = useLocalSearchParams<{
    id: string;
    universityId?: string;
    from?: string;
  }>();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { universities } = useCatalog();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email, whatsapp)')
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
            router.push({ pathname: '/(student)/(tabs)/profile', params: { resumeBook: apartment.id } }),
        },
      ]);
      return;
    }
    if (mismatch) {
      alert(t('common.error'), t('listing.genderMismatch'));
      return;
    }
    router.push({ pathname: '/(student)/book/[id]', params: { id: apartment.id } });
  };

  return (
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
    />
  );
}
