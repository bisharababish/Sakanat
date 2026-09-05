import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FAQ_KEYS } from '@/src/data/faq';
import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function FaqList() {
  const { t } = useTranslation();
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  const [open, setOpen] = useState<string | null>(FAQ_KEYS[0]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {FAQ_KEYS.map((key, index) => {
        const expanded = open === key;
        return (
          <View key={key}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            <Pressable
              onPress={() => setOpen(expanded ? null : key)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={({ pressed }) => [styles.head, row, pressed && styles.pressed]}
            >
              <Text style={[styles.question, rtlText, { color: colors.text }]}>{t(`menu.faq.${key}Q`)}</Text>
              <Ionicons
                name={expanded ? 'chevron-up' : isRtl ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
            {expanded ? (
              <Text style={[styles.answer, rtlText, { color: colors.textMuted }]}>{t(`menu.faq.${key}A`)}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  head: { alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8 },
  pressed: { opacity: 0.7 },
  question: { flex: 1, fontSize: 15, fontFamily: 'Cairo_700Bold' },
  answer: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular', paddingBottom: spacing.sm },
  divider: { height: 1 },
});
