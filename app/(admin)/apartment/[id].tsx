import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApartmentView } from '@/components/ApartmentView';
import { ListingQualityChecklist, apartmentHasQualityIssues } from '@/components/admin/ListingQualityChecklist';
import { Button } from '@/components/ui/Button';
import { NoteModal } from '@/components/ui/NoteModal';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { listingDistanceKm } from '@/src/lib/distance';
import { updateListingStatus } from '@/src/lib/listing';
import { LISTING_REJECT_PRESETS } from '@/src/lib/listingQuality';
import { notifyListingApproved, notifyListingRejected } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { OWNER_PUBLIC_PROFILE } from '@/src/lib/ownerPublic';
import { supabase } from '@/src/lib/supabase';
import type { Apartment, ListingStatus } from '@/src/types/database';

export default function AdminApartmentReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { row } = useLayout();
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
      .select(`*, cities(*), universities(*), profiles!owner_id(${OWNER_PUBLIC_PROFILE})`)
      .eq('id', id)
      .single();
    if (data) setApartment(data as Apartment);
    else setMissing(true);
  }, [id]);

  const { refreshing, refresh } = useLiveReload(load, ['apartments'], `admin-apartment:${id ?? ''}`);

  const university = useMemo(
    () => universities.find((item) => item.id === apartment?.nearest_university_id) ?? apartment?.universities,
    [apartment, universities],
  );

  const setStatus = async (status: ListingStatus, reason?: string | null) => {
    if (!apartment) return;
    if (status === 'approved' && apartmentHasQualityIssues(apartment) && apartment.status !== 'approved') {
      alert(t('admin.approveDespiteQuality'), t('admin.approveDespiteQualityBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.approveAnyway'),
          onPress: () => void applyStatus('approved', reason),
        },
      ]);
      return;
    }
    await applyStatus(status, reason);
  };

  const applyStatus = async (status: ListingStatus, reason?: string | null) => {
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
        asAdmin
        signedIn
        refreshing={refreshing}
        onRefresh={() => void refresh()}
      >
        {apartment ? (
          <View style={styles.actions}>
            <ListingQualityChecklist apartment={apartment} />
            <View style={[styles.actionsRow, row]}>
              {apartment.status !== 'approved' ? (
                <Button compact pill title={t('admin.approve')} onPress={() => void setStatus('approved')} loading={busy} />
              ) : (
                <Button
                  compact
                  pill
                  title={t('owner.hideListing')}
                  variant="secondary"
                  onPress={() => void setStatus('hidden')}
                  loading={busy}
                />
              )}
              {apartment.status === 'hidden' ? (
                <Button
                  compact
                  pill
                  title={t('owner.unhideListing')}
                  variant="secondary"
                  onPress={() => void setStatus('approved')}
                  loading={busy}
                />
              ) : null}
              {apartment.status !== 'rejected' ? (
                <Button
                  compact
                  pill
                  title={t('admin.reject')}
                  variant="danger"
                  onPress={() => {
                    setRejectNote('');
                    setRejecting(true);
                  }}
                />
              ) : null}
              <Button
                compact
                pill
                title={t('owner.editListing')}
                variant="secondary"
                onPress={() => router.push({ pathname: '/(admin)/listing/[id]', params: { id: apartment.id } })}
              />
              {apartment.owner_id ? (
                <Button
                  compact
                  pill
                  title={t('admin.editUser')}
                  variant="ghost"
                  onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: apartment.owner_id } })}
                />
              ) : null}
              <Button compact pill title={t('admin.deleteListing')} variant="ghost" onPress={removeListing} />
            </View>
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
        presets={LISTING_REJECT_PRESETS.map((key) => t(`admin.${key}`))}
        onChange={setRejectNote}
        onConfirm={() => void setStatus('rejected', rejectNote)}
        onClose={() => setRejecting(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  actionsRow: { flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
