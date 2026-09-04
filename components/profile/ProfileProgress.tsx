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

export function ProfileProgress({ items, onJump }: Props) {
  const { t } = useTranslation();
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  const total = items.length;
  const filled = items.filter((item) => item.done).length;
  const missing = items.filter((item) => !item.done);
  const ready = total > 0 && missing.length === 0;
  const percent = total ? Math.round((filled / total) * 100) : 0;

  return (
    <Card>
      <View style={[styles.head, row]}>
        <View style={[styles.icon, { backgroundColor: ready ? colors.successSoft : colors.primarySoft }]}>
          <Ionicons
            name={ready ? 'checkmark-circle' : 'sparkles-outline'}
            size={16}
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
        <>
          <Text style={[styles.need, rtlText, { color: colors.textMuted }]}>{t('profile.stillNeeded')}</Text>
          <View style={[styles.chips, row]}>
            {missing.map((item) => (
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
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  percent: { fontSize: 14, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  track: { height: 6, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 4 },
  need: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  chips: { flexWrap: 'wrap', gap: 6 },
  chip: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  chipText: { fontSize: 12, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
});
