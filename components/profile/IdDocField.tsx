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
  onView,
  compact,
  replace,
}: {
  label: string;
  hint?: string;
  uri?: string | null;
  busy?: boolean;
  onPress: () => void;
  onView?: () => void;
  compact?: boolean;
  replace?: boolean;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const action = replace ? t('profile.replaceCard') : uri ? t('profile.changePhoto') : t('profile.uploadCard');
  const thumb = uri ? (
    <Image source={{ uri }} style={[styles.preview, compact && styles.previewCompact]} contentFit="cover" />
  ) : (
    <View
      style={[
        styles.fallback,
        compact && styles.previewCompact,
        { backgroundColor: colors.primarySoft },
      ]}
    >
      <Ionicons name="id-card-outline" size={compact ? 16 : 18} color={colors.primary} />
    </View>
  );

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact, rtlText, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.box,
          compact && styles.boxCompact,
          row,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <Pressable
          onPress={uri && onView ? onView : onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={uri && onView ? t('profile.viewPhoto') : action}
        >
          {thumb}
        </Pressable>
        <Pressable
          onPress={onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={[styles.action, row]}
        >
          <View style={styles.copy}>
            <Text style={[styles.title, compact && styles.titleCompact, rtlText, { color: colors.text }]}>
              {action}
            </Text>
            {hint ? (
              <Text style={[styles.hint, rtlText, { color: colors.textMuted }]} numberOfLines={2}>
                {hint}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={compact ? 16 : 18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  wrapCompact: { gap: 3 },
  label: { fontWeight: '700', fontSize: 13, fontFamily: 'Cairo_700Bold' },
  labelCompact: { fontSize: 12 },
  box: {
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  boxCompact: {
    gap: 8,
    padding: 8,
    borderRadius: radius.sm,
  },
  action: { flex: 1, minWidth: 0, alignItems: 'center', gap: 10 },
  preview: { width: 56, height: 40, borderRadius: 8 },
  previewCompact: { width: 48, height: 34, borderRadius: 6 },
  fallback: {
    width: 56,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  titleCompact: { fontSize: 12 },
  hint: { fontSize: 11, lineHeight: 16, fontFamily: 'Cairo_400Regular' },
});
