import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { NAME_MAX, namePartCount, nameWords, sanitizeArabicName, sanitizeEnglishName } from '@/src/lib/name';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

const PARTS = ['nameFirst', 'nameSecond', 'nameThird', 'nameLast'] as const;

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  script: 'en' | 'ar';
  soft?: boolean;
};

export function NameField({ label, value, onChangeText, script, soft }: Props) {
  const { t } = useTranslation();
  const { row } = useLayout();
  const colors = useColors();
  const count = namePartCount(value);
  const filled = nameWords(value).length;
  const current = count;
  const shown = value.trim() || /[ \t]$/.test(value) ? count : 0;

  return (
    <View style={styles.wrap}>
      <Input
        label={label}
        value={value}
        onChangeText={(next) => onChangeText(script === 'en' ? sanitizeEnglishName(next) : sanitizeArabicName(next))}
        autoCapitalize="words"
        maxLength={NAME_MAX}
        ltr={script === 'en'}
        wrap
        soft={soft}
      />
      {shown ? (
        <View style={[styles.parts, row]}>
          {PARTS.slice(0, shown).map((key, index) => {
            const active = index + 1 === current;
            const done = index < filled && !active;
            return (
              <View
                key={key}
                style={[
                  styles.part,
                  row,
                  { backgroundColor: active ? colors.primarySoft : colors.surfaceMuted },
                ]}
              >
                <Text style={[styles.partText, { color: active || done ? colors.primary : colors.textMuted }]}>
                  {t(`profile.${key}`)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  parts: { flexWrap: 'wrap', gap: 6 },
  part: {
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  partText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
});
