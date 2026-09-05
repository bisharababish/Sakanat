import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import type { IdVerifyStatus } from '@/src/types/database';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  status?: IdVerifyStatus | null;
  compact?: boolean;
};

export function IdVerifyBadge({ status, compact }: Props) {
  const { t } = useTranslation();
  const { row } = useLayout();
  const colors = useColors();
  if (!status || status === 'none') return null;

  const tone =
    status === 'approved'
      ? { bg: colors.successSoft, fg: colors.success, icon: 'shield-checkmark' as const, label: t('profile.idVerified') }
      : status === 'pending'
        ? { bg: colors.warningSoft, fg: colors.warning, icon: 'time-outline' as const, label: t('profile.idPendingReview') }
        : { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' as const, label: t('profile.idRejected') };

  return (
    <View style={[styles.badge, row, { backgroundColor: tone.bg }, compact && styles.compact]}>
      <Ionicons name={tone.icon} size={compact ? 12 : 14} color={tone.fg} />
      <Text style={[styles.text, { color: tone.fg }, compact && styles.textCompact]} numberOfLines={1}>
        {tone.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  compact: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 12, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
  textCompact: { fontSize: 11 },
});
