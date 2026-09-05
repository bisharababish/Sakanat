import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function IdDocField({
  label,
  hint,
  uri,
  busy,
  onPress,
}: {
  label: string;
  hint?: string;
  uri?: string | null;
  busy?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, rtlText, { color: colors.text }]}>{label}</Text>
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={[styles.box, row, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.fallback, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="id-card-outline" size={18} color={colors.primary} />
          </View>
        )}
        <View style={styles.copy}>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>
            {uri ? t('profile.changePhoto') : t('profile.uploadCard')}
          </Text>
          {hint ? (
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]} numberOfLines={2}>
              {hint}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontWeight: '700', fontSize: 13, fontFamily: 'Cairo_700Bold' },
  box: {
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  preview: { width: 56, height: 40, borderRadius: 8 },
  fallback: {
    width: 56,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 11, lineHeight: 16, fontFamily: 'Cairo_400Regular' },
});
