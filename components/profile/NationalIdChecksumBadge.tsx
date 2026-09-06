import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { isValidNationalId, nationalIdChecksumOk } from '@/src/lib/trust';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function NationalIdChecksumBadge({ number }: { number?: string | null }) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const raw = (number ?? '').trim();
  if (!raw) return null;

  const ok = isValidNationalId(raw);
  const nineDigits = /^\d{9}$/.test(raw);
  const label = ok
    ? t('admin.nationalIdChecksumOk')
    : nineDigits && !nationalIdChecksumOk(raw)
      ? t('admin.nationalIdChecksumBad')
      : t('admin.nationalIdChecksumIncomplete');

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: ok ? colors.successSoft : colors.warningSoft,
          borderColor: ok ? colors.success : colors.warning,
        },
      ]}
    >
      <Text style={[styles.text, rtlText, { color: ok ? colors.success : colors.warning }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
});
