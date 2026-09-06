import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import { loadMyBlocks, unblockUser } from '@/src/lib/blocks';
import { displayName } from '@/src/lib/name';
import { alert } from '@/src/lib/notice';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { UserBlock } from '@/src/types/database';

export function BlockedUsersCard({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setBlocks(await loadMyBlocks(userId));
    } catch {
      setBlocks([]);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const unblock = (blockedId: string) => {
    alert(t('profile.unblockTitle'), t('profile.unblockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.unblock'),
        onPress: async () => {
          setBusyId(blockedId);
          try {
            await unblockUser(userId, blockedId);
            await reload();
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <Card compact>
      <SectionHead compact icon="hand-left-outline" title={t('profile.blockedTitle')} />
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.blockedHint')}</Text>
      {blocks.length === 0 ? (
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.blockedEmpty')}</Text>
      ) : (
        blocks.map((item) => (
          <View
            key={item.blocked_id}
            style={[styles.row, row, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          >
            <View style={styles.copy}>
              <Text style={[styles.name, rtlText, { color: colors.text }]}>
                {displayName(item.blocked, i18n.language) || item.blocked?.email || item.blocked_id}
              </Text>
              {item.blocked?.role ? (
                <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
                  {t(`roles.${item.blocked.role}`)}
                </Text>
              ) : null}
            </View>
            <Button
              title={t('profile.unblock')}
              variant="secondary"
              pill
              loading={busyId === item.blocked_id}
              onPress={() => unblock(item.blocked_id)}
            />
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular', marginBottom: spacing.xs },
  row: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  meta: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
});
