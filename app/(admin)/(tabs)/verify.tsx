import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdDocsViewer } from '@/components/profile/IdDocsViewer';
import { IdVerifyBadge } from '@/components/profile/IdVerifyBadge';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoteModal } from '@/components/ui/NoteModal';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { displayName } from '@/src/lib/name';
import { alert } from '@/src/lib/notice';
import { hasIdDocs, setIdVerifyStatus } from '@/src/lib/trust';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Profile } from '@/src/types/database';

export default function AdminVerifyIds() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [docsFor, setDocsFor] = useState<Profile | null>(null);
  const [rejecting, setRejecting] = useState<Profile | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, full_name_en, email, role, national_id_url, university_card_url, national_id_number, id_verify_status, id_verify_note, home_address, emergency_name, emergency_phone',
      )
      .eq('id_verify_status', 'pending')
      .order('created_at', { ascending: true });
    if (error) {
      setUsers([]);
      return;
    }
    setUsers(((data as Profile[]) ?? []).filter((item) => hasIdDocs(item)));
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['profiles'], 'admin-verify-ids');

  const decide = async (user: Profile, status: 'approved' | 'rejected', note?: string) => {
    setBusy(true);
    const error = await setIdVerifyStatus(user.id, status, note, me?.id);
    setBusy(false);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    setRejecting(null);
    setRejectNote('');
    void load();
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.idReviewTitle')}</Text>
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.idReviewHint')}</Text>

      {users.length === 0 ? <EmptyState title={t('admin.idReviewEmpty')} /> : null}

      {users.map((user) => (
        <Card key={user.id}>
          <Pressable onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: user.id } })}>
            <Text style={[styles.name, rtlText, { color: colors.text }]}>
              {displayName(user, i18n.language) || user.email}
            </Text>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
              {t(`roles.${user.role}`)} · {user.email}
            </Text>
          </Pressable>
          <IdVerifyBadge status={user.id_verify_status ?? 'pending'} />
          {user.national_id_number ? (
            <Text style={[styles.meta, rtlText, { color: colors.text }]}>
              {t('profile.nationalId')} {user.national_id_number}
            </Text>
          ) : null}
          <View style={[styles.actions, row]}>
            <Button title={t('profile.idCards')} variant="secondary" pill onPress={() => setDocsFor(user)} />
            <Button
              title={t('admin.approveId')}
              pill
              loading={busy}
              onPress={() => void decide(user, 'approved')}
            />
            <Button
              title={t('admin.rejectId')}
              variant="danger"
              pill
              disabled={busy}
              onPress={() => setRejecting(user)}
            />
          </View>
        </Card>
      ))}

      <IdDocsViewer
        visible={Boolean(docsFor)}
        nationalPath={docsFor?.national_id_url}
        universityPath={docsFor?.university_card_url}
        onClose={() => setDocsFor(null)}
      />

      <NoteModal
        visible={Boolean(rejecting)}
        title={t('admin.rejectId')}
        label={t('admin.rejectIdNote')}
        hint={t('admin.rejectIdHint')}
        value={rejectNote}
        confirmTitle={t('admin.rejectId')}
        loading={busy}
        onChange={setRejectNote}
        onConfirm={() => {
          if (!rejecting) return;
          if (!rejectNote.trim()) {
            alert(t('common.error'), t('admin.rejectIdNote'));
            return;
          }
          void decide(rejecting, 'rejected', rejectNote);
        }}
        onClose={() => {
          setRejecting(null);
          setRejectNote('');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular', marginBottom: spacing.sm },
  name: { fontSize: 16, fontFamily: 'Cairo_800ExtraBold' },
  meta: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  actions: { flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
