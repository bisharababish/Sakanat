import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export type ProfileCheck = { id?: string; label: string; done: boolean };

type Props = {
  items: ProfileCheck[];
  onJump?: (id: string) => void;
};

const CHIP_LIMIT = 4;

export function ProfileProgress({ items, onJump }: Props) {
  const { t } = useTranslation();
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  const total = items.length;
  const filled = items.filter((item) => item.done).length;
  const missing = items.filter((item) => !item.done);
  const ready = total > 0 && missing.length === 0;
  const percent = total ? Math.round((filled / total) * 100) : 0;
  const shown = missing.slice(0, CHIP_LIMIT);
  const extra = missing.length - shown.length;

  return (
    <Card compact>
      <View style={[styles.head, row]}>
        <View style={[styles.icon, { backgroundColor: ready ? colors.successSoft : colors.primarySoft }]}>
          <Ionicons
            name={ready ? 'checkmark-circle' : 'sparkles-outline'}
            size={14}
            color={ready ? colors.success : colors.primary}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('profile.progressTitle')}</Text>
          <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>
            {ready ? t('profile.readyToBook') : t('profile.progressOf', { filled, total })}
          </Text>
        </View>
        <Text style={[styles.percent, { color: ready ? colors.success : colors.primary }]}>{percent}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              alignSelf: isRtl ? 'flex-end' : 'flex-start',
              backgroundColor: ready ? colors.success : colors.primary,
            },
          ]}
        />
      </View>
      {ready ? null : (
        <View style={[styles.chips, row]}>
          {shown.map((item) => (
            <Pressable
              key={item.id ?? item.label}
              onPress={() => item.id && onJump?.(item.id)}
              style={[styles.chip, row, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
            >
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          {extra > 0 ? (
            <View style={[styles.chip, row, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.textMuted }]}>+{extra}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8 },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 0 },
  title: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  percent: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  chips: { flexWrap: 'wrap', gap: 4 },
  chip: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  chipText: { fontSize: 11, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
});
