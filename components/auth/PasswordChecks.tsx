import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { passwordChecks } from '@/src/lib/password';
import { useColors } from '@/src/theme/ThemeProvider';

function Row({ ok, label }: { ok: boolean; label: string }) {
  const { row } = useLayout();
  const colors = useColors();
  return (
    <View style={[styles.row, row]}>
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={ok ? colors.success : colors.textMuted} />
      <Text style={[styles.label, { color: ok ? colors.success : colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function PasswordChecks({ password, confirm }: { password: string; confirm?: string }) {
  const { t } = useTranslation();
  if (!password && !confirm) return null;
  const checks = passwordChecks(password, confirm);
  return (
    <View style={styles.wrap}>
      <Row ok={checks.length} label={t('auth.passwordLength')} />
      <Row ok={checks.upper} label={t('auth.passwordUpper')} />
      <Row ok={checks.lower} label={t('auth.passwordLower')} />
      <Row ok={checks.number} label={t('auth.passwordNumber')} />
      {confirm != null ? <Row ok={checks.match} label={t('auth.passwordMatch')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { alignItems: 'center', gap: 8 },
  label: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
});
