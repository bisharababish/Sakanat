import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { colors, radius } from '@/src/theme/colors';

type Tone = 'pending' | 'approved' | 'rejected' | 'info';

const tones: Record<Tone, { bg: string; text: string }> = {
  pending: { bg: colors.warningSoft, text: colors.warning },
  approved: { bg: colors.successSoft, text: colors.success },
  rejected: { bg: colors.dangerSoft, text: colors.danger },
  info: { bg: colors.infoSoft, text: colors.info },
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const { alignStart, writingDirection } = useLayout();
  const palette = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, alignSelf: alignStart }]}>
      <Text style={[styles.text, { color: palette.text, writingDirection }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
