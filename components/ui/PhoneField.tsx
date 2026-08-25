import { I18nManager, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { useLayout } from '@/src/hooks/useLayout';
import { regionPrefix, type PhoneRegion } from '@/src/lib/phone';
import { colors, radius, spacing } from '@/src/theme/colors';

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

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, rtlText]}>{label}</Text>
      <View style={[styles.chipRow, { justifyContent: alignStart }]}>
        <Chip label={regionPrefix('ps')} selected={region === 'ps'} onPress={() => onRegionChange('ps')} />
        <Chip label={regionPrefix('il')} selected={region === 'il'} onPress={() => onRegionChange('il')} />
      </View>
      <View style={[styles.inputRow, soft ? styles.soft : null, { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.prefix}>{regionPrefix(region)}</Text>
        <TextInput
          value={local}
          onChangeText={onLocalChange}
          keyboardType="phone-pad"
          placeholder={region === 'ps' ? '59xxxxxxx' : '5xxxxxxxx'}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="left"
          style={styles.input}
        />
      </View>
      {hint ? <Text style={[styles.hint, rtlText]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
  inputRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    gap: 8,
  },
  soft: {
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
    borderRadius: radius.full,
    minHeight: 54,
  },
  prefix: { fontWeight: '800', color: colors.primary, writingDirection: 'ltr' },
  input: { flex: 1, fontSize: 16, color: colors.text, minHeight: 48 },
  hint: { color: colors.textMuted, fontSize: 12 },
});
