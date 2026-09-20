import { Keyboard, Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { LegalDocModal } from '@/components/LegalDocModal';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useLayout } from '@/src/hooks/useLayout';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { useAuth } from '@/src/lib/auth';
import { LEGAL_VERSION, needsLegalAccept } from '@/src/lib/legal';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function LegalGate() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile, mfaPending, mfaEnrollRequired } = useAuth();
  const safe = useModalSafeArea();
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const [busy, setBusy] = useState(false);
  const open = Boolean(profile && !mfaPending && !mfaEnrollRequired && needsLegalAccept(profile));
  useEdgeBack(open, () => {});

  useEffect(() => {
    if (!open) return;
    Keyboard.dismiss();
    const tick = setTimeout(() => Keyboard.dismiss(), 80);
    return () => clearTimeout(tick);
  }, [open]);

  if (!open || !profile) return null;

  const accept = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          accepted_legal_version: LEGAL_VERSION,
          accepted_terms_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal visible transparent animationType="fade" onShow={() => Keyboard.dismiss()}>
        <View
          style={[
            styles.overlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: Math.max(safe.top, spacing.lg),
              paddingBottom: Math.max(safe.bottom, spacing.lg),
            },
          ]}
        >
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{t('legal.updateTitle')}</Text>
            <Text style={[styles.body, rtlText, { color: colors.text }]}>{t('legal.updateBody')}</Text>
            <Button title={t('menu.terms')} variant="ghost" pill onPress={() => setLegal('terms')} />
            <Button title={t('menu.privacy')} variant="ghost" pill onPress={() => setLegal('privacy')} />
            <Button title={t('legal.accept')} pill loading={busy} onPress={() => void accept()} />
          </View>
        </View>
      </Modal>
      <LegalDocModal kind={legal} onClose={() => setLegal(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  body: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
});
