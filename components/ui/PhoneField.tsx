import { I18nManager, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { useLayout } from '@/src/hooks/useLayout';
import { phoneLocalMax, regionPrefix, sanitizePhoneLocal, type PhoneRegion } from '@/src/lib/phone';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  label: string;
  region: PhoneRegion;
  local: string;
  onRegionChange: (region: PhoneRegion) => void;
  onLocalChange: (value: string) => void;
  hint?: string;
  soft?: boolean;
  compact?: boolean;
};

export function PhoneField({
  label,
  region,
  local,
  onRegionChange,
  onLocalChange,
  hint,
  soft,
  compact,
}: Props) {
  const { rtlText, alignStart } = useLayout();
  const colors = useColors();
  const maxLength = phoneLocalMax(local);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact, rtlText, { color: colors.text }]}>
        {label}
      </Text>
      <View style={[styles.chipRow, compact && styles.chipRowCompact, { justifyContent: alignStart }]}>
        <Chip
          compact={compact}
          label={regionPrefix('ps')}
          selected={region === 'ps'}
          onPress={() => onRegionChange('ps')}
        />
        <Chip
          compact={compact}
          label={regionPrefix('il')}
          selected={region === 'il'}
          onPress={() => onRegionChange('il')}
        />
      </View>
      <View
        style={[
          styles.inputRow,
          compact && styles.inputRowCompact,
          {
            flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
            backgroundColor: soft ? colors.surfaceMuted : colors.surface,
            borderColor: soft ? 'transparent' : colors.border,
            borderRadius: soft ? radius.full : compact ? radius.sm : radius.md,
            minHeight: soft ? 54 : compact ? 40 : 52,
          },
        ]}
      >
        <Text style={[styles.prefix, compact && styles.prefixCompact, { color: colors.primary }]}>
          {regionPrefix(region)}
        </Text>
        <TextInput
          value={local}
          onChangeText={(value) => onLocalChange(sanitizePhoneLocal(value))}
          keyboardType="phone-pad"
          placeholder={region === 'ps' ? '59xxxxxxx' : '5xxxxxxxx'}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={maxLength}
          textAlign="left"
          style={[styles.input, compact && styles.inputCompact, { color: colors.text }]}
        />
      </View>
      {hint ? <Text style={[styles.hint, compact && styles.hintCompact, rtlText, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wrapCompact: { gap: 4 },
  label: { fontWeight: '700', fontSize: 14 },
  labelCompact: { fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
  chipRowCompact: { gap: 6 },
  inputRow: {
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  inputRowCompact: { paddingHorizontal: spacing.sm, gap: 6 },
  prefix: { fontWeight: '800', writingDirection: 'ltr' },
  prefixCompact: { fontSize: 13 },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  inputCompact: { fontSize: 14, minHeight: 36 },
  hint: { fontSize: 12 },
  hintCompact: { fontSize: 11 },
});
