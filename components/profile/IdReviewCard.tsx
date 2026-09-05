import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdDocsViewer } from '@/components/profile/IdDocsViewer';
import { IdVerifyBadge } from '@/components/profile/IdVerifyBadge';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoteModal } from '@/components/ui/NoteModal';
import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import { setIdVerifyStatus } from '@/src/lib/trust';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Profile } from '@/src/types/database';

export function IdReviewCard({
  user,
  meId,
  onChanged,
}: {
  user: Profile;
  meId?: string | null;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const [docsOpen, setDocsOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);
  const status = user.id_verify_status ?? 'none';

  const decide = async (next: 'approved' | 'rejected' | 'pending', note?: string) => {
    setBusy(true);
    const error = await setIdVerifyStatus(user.id, next, note, meId);
    setBusy(false);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    setRejectOpen(false);
    setRejectNote('');
    onChanged();
  };

  return (
    <>
      <Card>
        <SectionHead icon="shield-checkmark-outline" title={t('admin.idReviewTitle')} />
        <IdVerifyBadge status={status} />
        {status === 'rejected' && user.id_verify_note ? (
          <Text style={[styles.note, rtlText, { color: colors.danger }]}>{user.id_verify_note}</Text>
        ) : null}
        <View style={[styles.actions, row]}>
          <Button title={t('profile.viewIdCards')} variant="secondary" pill onPress={() => setDocsOpen(true)} />
          {status !== 'approved' ? (
            <Button title={t('admin.approveId')} pill loading={busy} onPress={() => void decide('approved')} />
          ) : null}
          {status !== 'rejected' ? (
            <Button
              title={t('admin.rejectId')}
              variant="danger"
              pill
              disabled={busy}
              onPress={() => setRejectOpen(true)}
            />
          ) : (
            <Button
              title={t('admin.reopenId')}
              variant="secondary"
              pill
              loading={busy}
              onPress={() => void decide('pending')}
            />
          )}
        </View>
      </Card>
      <IdDocsViewer
        visible={docsOpen}
        nationalPath={user.national_id_url}
        universityPath={user.university_card_url}
        onClose={() => setDocsOpen(false)}
      />
      <NoteModal
        visible={rejectOpen}
        title={t('admin.rejectId')}
        label={t('admin.rejectIdNote')}
        hint={t('admin.rejectIdHint')}
        value={rejectNote}
        confirmTitle={t('admin.rejectId')}
        loading={busy}
        onChange={setRejectNote}
        onConfirm={() => void decide('rejected', rejectNote)}
        onClose={() => {
          setRejectOpen(false);
          setRejectNote('');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  actions: { flexWrap: 'wrap', gap: 8 },
});
