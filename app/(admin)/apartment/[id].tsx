import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApartmentView } from '@/components/ApartmentView';
import { Button } from '@/components/ui/Button';
import { NoteModal } from '@/components/ui/NoteModal';
import { useCatalog } from '@/src/hooks/useCatalog';
import { listingDistanceKm } from '@/src/lib/distance';
import { updateListingStatus } from '@/src/lib/listing';
import { notifyListingApproved, notifyListingRejected } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import type { Apartment, ListingStatus } from '@/src/types/database';

export default function AdminApartmentReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { universities } = useCatalog();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email, whatsapp)')
      .eq('id', id)
      .single();
    if (data) setApartment(data as Apartment);
    else setMissing(true);
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

  const setStatus = async (status: ListingStatus, reason?: string | null) => {
    if (!apartment) return;
    setBusy(true);
    const { error } = await updateListingStatus(apartment.id, status, reason);
    setBusy(false);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    if (status === 'approved' && apartment.status !== 'approved') notifyListingApproved(apartment.owner_id);
    if (status === 'rejected' && apartment.status !== 'rejected') notifyListingRejected(apartment.owner_id);
    setRejecting(false);
    setRejectNote('');
    void load();
  };

  const removeListing = () => {
    if (!apartment) return;
    alert(t('admin.deleteListing'), t('admin.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', apartment.id);
          if (error) alert(t('common.error'), error.message);
          else router.back();
        },
      },
    ]);
  };

  return (
    <>
      <ApartmentView
        apartment={apartment}
        missing={missing}
        university={university}
        distance={apartment ? listingDistanceKm(apartment, university) : null}
        preview
        signedIn
      >
        {apartment ? (
          <View style={styles.actions}>
            {apartment.status !== 'approved' ? (
              <Button title={t('admin.approve')} onPress={() => void setStatus('approved')} loading={busy} pill />
            ) : (
              <Button
                title={t('owner.hideListing')}
                variant="secondary"
                onPress={() => void setStatus('hidden')}
                loading={busy}
                pill
              />
            )}
            {apartment.status === 'hidden' ? (
              <Button
                title={t('owner.unhideListing')}
                variant="secondary"
                onPress={() => void setStatus('approved')}
                loading={busy}
                pill
              />
            ) : null}
            {apartment.status !== 'rejected' ? (
              <Button
                title={t('admin.reject')}
                variant="danger"
                onPress={() => {
                  setRejectNote('');
                  setRejecting(true);
                }}
                pill
              />
            ) : null}
            <Button
              title={t('owner.editListing')}
              variant="secondary"
              pill
              onPress={() => router.push({ pathname: '/(admin)/listing/[id]', params: { id: apartment.id } })}
            />
            {apartment.owner_id ? (
              <Button
                title={t('admin.editUser')}
                variant="ghost"
                pill
                onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: apartment.owner_id } })}
              />
            ) : null}
            <Button title={t('admin.deleteListing')} variant="ghost" onPress={removeListing} />
          </View>
        ) : null}
      </ApartmentView>
      <NoteModal
        visible={rejecting}
        title={t('admin.rejectListing')}
        label={t('booking.rejectNote')}
        hint={t('admin.rejectListingHint')}
        value={rejectNote}
        confirmTitle={t('admin.reject')}
        loading={busy}
        onChange={setRejectNote}
        onConfirm={() => void setStatus('rejected', rejectNote)}
        onClose={() => setRejecting(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
});
