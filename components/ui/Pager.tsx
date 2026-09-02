import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export function Pager({
  page,
  pages,
  from,
  to,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  pageSize: number;
  onPage: (next: number) => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();

  if (total === 0) return null;

  return (
    <View style={styles.wrap}>
      {total > pageSize ? (
        <View style={[styles.row, row]}>
          <View style={styles.flex}>
            <Button
              title={t('common.previous')}
              variant="secondary"
              pill
              disabled={page === 0}
              onPress={() => onPage(page - 1)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title={t('common.next')}
              variant="secondary"
              pill
              disabled={page >= pages - 1}
              onPress={() => onPage(page + 1)}
            />
          </View>
        </View>
      ) : null}
      <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
        {t('common.pageRange', { from, to, total })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  meta: { fontSize: 13, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
});
