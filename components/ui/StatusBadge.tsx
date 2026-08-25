import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Tone = 'pending' | 'approved' | 'rejected' | 'info';

export function StatusBadge({ label, tone, overlay }: { label: string; tone: Tone; overlay?: boolean }) {
  const { isRtl, textAlign, writingDirection } = useLayout();
  const colors = useColors();
  const palette = {
    pending: { bg: colors.warningSoft, text: colors.warning },
    approved: { bg: colors.successSoft, text: colors.success },
    rejected: { bg: colors.dangerSoft, text: colors.danger },
    info: { bg: colors.infoSoft, text: colors.info },
  }[tone];
  return (
    <View
      style={[
        styles.badge,
        overlay ? [styles.overlay, { borderColor: colors.white, shadowColor: colors.text }] : null,
        { backgroundColor: palette.bg, alignSelf: overlay ? 'auto' : isRtl ? 'flex-end' : 'flex-start' },
      ]}
    >
      <Text style={[styles.text, { color: palette.text, textAlign, writingDirection }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  overlay: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  text: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
});
