import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { isValidNationalIdExpiry, nationalIdExpiryState } from '@/src/lib/trust';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function NationalIdExpiryBadge({ expiresAt }: { expiresAt?: string | null }) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const raw = (expiresAt ?? '').trim();
  if (!raw) return null;

  const state = nationalIdExpiryState(raw);
  const ok = isValidNationalIdExpiry(raw);
  const label =
    state === 'expired'
      ? t('profile.idExpired')
      : state === 'soon'
        ? t('profile.idExpiresSoon')
        : state === 'ok'
          ? t('profile.idExpiryOk')
          : t('profile.idExpiryHint');

  const tone =
    state === 'ok'
      ? { bg: colors.successSoft, border: colors.success, text: colors.success }
      : state === 'soon'
        ? { bg: colors.warningSoft, border: colors.warning, text: colors.warning }
        : { bg: colors.dangerSoft, border: colors.danger, text: colors.danger };

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.text, rtlText, { color: tone.text }]}>
        {ok && state === 'ok' ? t('profile.idExpiryValid') : label}
      </Text>
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
