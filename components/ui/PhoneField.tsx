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
};

export function PhoneField({ label, region, local, onRegionChange, onLocalChange, hint, soft }: Props) {
  const { rtlText, alignStart } = useLayout();
  const colors = useColors();
  const maxLength = phoneLocalMax(local);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, rtlText, { color: colors.text }]}>{label}</Text>
      <View style={[styles.chipRow, { justifyContent: alignStart }]}>
        <Chip label={regionPrefix('ps')} selected={region === 'ps'} onPress={() => onRegionChange('ps')} />
        <Chip label={regionPrefix('il')} selected={region === 'il'} onPress={() => onRegionChange('il')} />
      </View>
      <View
        style={[
          styles.inputRow,
          {
            flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
            backgroundColor: soft ? colors.surfaceMuted : colors.surface,
            borderColor: soft ? 'transparent' : colors.border,
            borderRadius: soft ? radius.full : radius.md,
            minHeight: soft ? 54 : 52,
          },
        ]}
      >
        <Text style={[styles.prefix, { color: colors.primary }]}>{regionPrefix(region)}</Text>
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
          style={[styles.input, { color: colors.text }]}
        />
      </View>
      {hint ? <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
  inputRow: {
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  prefix: { fontWeight: '800', writingDirection: 'ltr' },
  input: { flex: 1, fontSize: 16, minHeight: 48 },
  hint: { fontSize: 12 },
});
