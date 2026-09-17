import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { AMENITY_ICONS, SEARCH_AMENITY_PRIMARY } from '@/src/lib/amenities';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import { AMENITIES, type Amenity } from '@/src/types/database';

export function AmenityChips({
  values,
  onToggle,
}: {
  values: Amenity[];
  onToggle: (next: Amenity) => void;
}) {
  const { t } = useTranslation();
  const { isRtl, row } = useLayout();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(values), [values]);
  const extra = AMENITIES.filter((key) => !SEARCH_AMENITY_PRIMARY.includes(key));
  const extraSelected = extra.filter((key) => selected.has(key)).length;
  const shown = open
    ? AMENITIES
    : [
        ...SEARCH_AMENITY_PRIMARY,
        ...extra.filter((key) => selected.has(key)),
      ];
  const hidden = extra.length - extraSelected;

  return (
    <View style={[styles.wrap, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
      {shown.map((key) => {
        const on = selected.has(key);
        return (
          <Pressable
            key={key}
            onPress={() => onToggle(key)}
            style={[
              styles.chip,
              row,
              {
                backgroundColor: on ? colors.primary : colors.surfaceMuted,
                borderColor: on ? colors.primary : colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(`amenities.${key}`)}
          >
            <Ionicons name={AMENITY_ICONS[key]} size={13} color={on ? colors.white : colors.primary} />
            <Text style={[styles.label, { color: on ? colors.white : colors.text }]} numberOfLines={1}>
              {t(`amenitiesShort.${key}`)}
            </Text>
          </Pressable>
        );
      })}
      {open || hidden > 0 ? (
        <Pressable
          onPress={() => setOpen((value) => !value)}
          style={[styles.chip, row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.label, { color: colors.primary }]}>
            {open ? t('listing.hideAmenities') : t('listing.moreAmenities', { count: hidden })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, maxWidth: '100%' },
  chip: {
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 8,
    maxWidth: '100%',
  },
  label: { fontSize: 11, fontFamily: 'Cairo_700Bold', flexShrink: 1 },
});
