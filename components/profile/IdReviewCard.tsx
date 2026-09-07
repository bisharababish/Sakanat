import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdApproveChecklist, idApproveReady, type IdApproveChecks } from '@/components/profile/IdApproveChecklist';
import { IdDocsViewer } from '@/components/profile/IdDocsViewer';
import { IdVerifyBadge } from '@/components/profile/IdVerifyBadge';
import { NationalIdChecksumBadge } from '@/components/profile/NationalIdChecksumBadge';
import { NationalIdExpiryBadge } from '@/components/profile/NationalIdExpiryBadge';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoteModal } from '@/components/ui/NoteModal';
import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import { setIdVerifyStatus } from '@/src/lib/trust';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Profile } from '@/src/types/database';

const EMPTY_CHECKS: IdApproveChecks = { readable: false, correctCard: false, numberMatches: false };

export function IdReviewCard({
  user,
  meId,
  onChanged,
  compact,
}: {
  user: Profile;
  meId?: string | null;
  onChanged: () => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const [docsOpen, setDocsOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<IdApproveChecks>(EMPTY_CHECKS);
  const status = user.id_verify_status ?? 'none';
  const requireNumberMatch = Boolean(user.national_id_number?.trim());
  const canApprove = idApproveReady(checks, requireNumberMatch);

  const decide = async (next: 'approved' | 'rejected' | 'pending', note?: string) => {
    if (next === 'approved' && !canApprove) {
      alert(t('common.error'), t('admin.approveChecklistNeeded'));
      return;
    }
    setBusy(true);
    const error = await setIdVerifyStatus(user.id, next, note, meId);
    setBusy(false);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    setRejectOpen(false);
    setRejectNote('');
    setChecks(EMPTY_CHECKS);
    onChanged();
  };

  return (
    <>
      <Card compact={compact}>
        <SectionHead compact={compact} icon="shield-checkmark-outline" title={t('admin.idReviewTitle')} />
        <IdVerifyBadge status={status} />
        {user.national_id_number ? (
          <View style={styles.idRow}>
            <Text style={[styles.meta, rtlText, { color: colors.text }]}>
              {t('profile.nationalId')} {user.national_id_number}
            </Text>
            <NationalIdChecksumBadge number={user.national_id_number} />
          </View>
        ) : null}
        {user.national_id_expires_at ? (
          <View style={styles.idRow}>
            <Text style={[styles.meta, rtlText, { color: colors.text }]}>
              {t('profile.nationalIdExpiry')} {String(user.national_id_expires_at).slice(0, 10)}
            </Text>
            <NationalIdExpiryBadge expiresAt={user.national_id_expires_at} />
          </View>
        ) : null}
        {status === 'rejected' && user.id_verify_note ? (
          <Text style={[styles.note, rtlText, { color: colors.danger }]}>{user.id_verify_note}</Text>
        ) : null}
        {status !== 'approved' ? (
          <IdApproveChecklist value={checks} onChange={setChecks} requireNumberMatch={requireNumberMatch} />
        ) : null}
        <View style={[styles.actions, row]}>
          <Button title={t('profile.viewIdCards')} variant="secondary" pill onPress={() => setDocsOpen(true)} />
          {status !== 'approved' ? (
            <Button
              title={t('admin.approveId')}
              pill
              loading={busy}
              disabled={!canApprove}
              onPress={() => void decide('approved')}
            />
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
  meta: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  idRow: { gap: 6 },
  actions: { flexWrap: 'wrap', gap: 8 },
});
