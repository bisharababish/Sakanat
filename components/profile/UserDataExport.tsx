import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { captureRef } from 'react-native-view-shot';

import { UserExportCard } from '@/components/profile/UserExportCard';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import {
  buildUserExportCsv,
  buildUserExportSummaryText,
  loadUserExportBundle,
  shareCsvFile,
  shareImageUri,
  shareTextFallback,
  type UserExportBundle,
} from '@/src/lib/dataExport';
import { alert } from '@/src/lib/notice';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function UserDataExport({
  userId,
  compact,
  titleKey = 'profile.downloadMyData',
}: {
  userId: string;
  compact?: boolean;
  titleKey?: string;
}) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const cardRef = useRef<View>(null);
  const [bundle, setBundle] = useState<UserExportBundle | null>(null);
  const [busyCsv, setBusyCsv] = useState(false);
  const [busyImage, setBusyImage] = useState(false);

  const ensureBundle = async () => {
    if (bundle && bundle.profile.id === userId) return bundle;
    const next = await loadUserExportBundle(userId);
    setBundle(next);
    return next;
  };

  const exportCsv = async () => {
    setBusyCsv(true);
    try {
      const data = await ensureBundle();
      const csv = buildUserExportCsv(data, i18n.language);
      const stamp = data.exportedAt.slice(0, 10);
      await shareCsvFile(`sakanat-${data.profile.role}-${stamp}.csv`, csv);
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.exportFailed'));
    } finally {
      setBusyCsv(false);
    }
  };

  const exportImage = async () => {
    setBusyImage(true);
    try {
      const data = await loadUserExportBundle(userId);
      setBundle(data);
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        const uri = await captureRef(cardRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        await shareImageUri(uri, t('profile.exportSummaryImage'));
      } catch {
        await shareTextFallback(buildUserExportSummaryText(data, i18n.language, t), t('profile.exportSummaryImage'));
      }
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.exportFailed'));
    } finally {
      setBusyImage(false);
    }
  };

  return (
    <>
      <Card compact={compact}>
        <SectionHead compact={compact} icon="download-outline" title={t(titleKey)} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.downloadMyDataHint')}</Text>
        <View style={styles.actions}>
          <Button title={t('profile.exportCsv')} onPress={() => void exportCsv()} loading={busyCsv} pill />
          <Button
            title={t('profile.exportSummaryImage')}
            variant="secondary"
            onPress={() => void exportImage()}
            loading={busyImage}
            pill
          />
        </View>
      </Card>
      {/* Off-screen capture target */}
      <View style={styles.captureHost} pointerEvents="none">
        {bundle ? <UserExportCard ref={cardRef} bundle={bundle} /> : <View ref={cardRef} collapsable={false} />}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular', marginBottom: spacing.xs },
  actions: { gap: 8 },
  captureHost: {
    position: 'absolute',
    left: -9999,
    top: 0,
    opacity: 1,
  },
});
