import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { useLayout } from '@/src/hooks/useLayout';
import { idDocUrl } from '@/src/lib/upload';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function IdDocsViewer({
  visible,
  nationalPath,
  universityPath,
  onClose,
}: {
  visible: boolean;
  nationalPath?: string | null;
  universityPath?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [national, setNational] = useState<string | null>(null);
  const [university, setUniversity] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void Promise.all([idDocUrl(nationalPath), idDocUrl(universityPath)]).then(([nextNational, nextUniversity]) => {
      if (!active) return;
      setNational(nextNational);
      setUniversity(nextUniversity);
    });
    return () => {
      active = false;
    };
  }, [visible, nationalPath, universityPath]);

  const photos = [national, university].filter(Boolean) as string[];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('profile.idCards')}</Text>
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.idCardsHint')}</Text>
          <View style={styles.grid}>
            <View style={styles.slot}>
              <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.nationalCard')}</Text>
              {national ? (
                <Pressable onPress={() => setViewer(photos)}>
                  <Image source={{ uri: national }} style={styles.photo} contentFit="cover" />
                </Pressable>
              ) : (
                <View style={[styles.missing, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.missingText, rtlText, { color: colors.textMuted }]}>{t('profile.cardMissing')}</Text>
                </View>
              )}
            </View>
            <View style={styles.slot}>
              <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.universityCard')}</Text>
              {university ? (
                <Pressable onPress={() => setViewer(photos)}>
                  <Image source={{ uri: university }} style={styles.photo} contentFit="cover" />
                </Pressable>
              ) : (
                <View style={[styles.missing, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.missingText, rtlText, { color: colors.textMuted }]}>{t('profile.cardMissing')}</Text>
                </View>
              )}
            </View>
          </View>
          <Button title={t('common.close')} variant="secondary" pill onPress={onClose} />
        </View>
      </View>
      <PhotoViewer
        photos={viewer}
        index={0}
        visible={viewer.length > 0}
        onIndexChange={() => undefined}
        onClose={() => setViewer([])}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
  grid: { gap: spacing.sm },
  slot: { gap: 6 },
  label: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  photo: { width: '100%', height: 160, borderRadius: radius.md },
  missing: {
    height: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  missingText: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
});
