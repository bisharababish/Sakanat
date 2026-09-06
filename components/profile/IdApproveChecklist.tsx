import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export type IdApproveChecks = {
  readable: boolean;
  correctCard: boolean;
  numberMatches: boolean;
};

export function IdApproveChecklist({
  value,
  onChange,
  requireNumberMatch,
}: {
  value: IdApproveChecks;
  onChange: (next: IdApproveChecks) => void;
  requireNumberMatch: boolean;
}) {
  const { t } = useTranslation();
  const { row, rtlText } = useLayout();
  const colors = useColors();

  const items: { key: keyof IdApproveChecks; label: string; show: boolean }[] = [
    { key: 'readable', label: t('admin.approveCheckReadable'), show: true },
    { key: 'correctCard', label: t('admin.approveCheckCard'), show: true },
    { key: 'numberMatches', label: t('admin.approveCheckNumber'), show: requireNumberMatch },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, rtlText, { color: colors.textMuted }]}>{t('admin.approveChecklist')}</Text>
      {items
        .filter((item) => item.show)
        .map((item) => {
          const on = value[item.key];
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange({ ...value, [item.key]: !on })}
              style={[styles.row, row]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={22}
                color={on ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.label, rtlText, { color: colors.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
    </View>
  );
}

export function idApproveReady(checks: IdApproveChecks, requireNumberMatch: boolean) {
  if (!checks.readable || !checks.correctCard) return false;
  if (requireNumberMatch && !checks.numberMatches) return false;
  return true;
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 4 },
  title: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  row: { alignItems: 'center', gap: 8, minHeight: 36 },
  label: { flex: 1, fontSize: 13, fontFamily: 'Cairo_400Regular' },
});
