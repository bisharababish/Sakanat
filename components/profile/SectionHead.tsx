import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  compact?: boolean;
};

export function SectionHead({ icon, title, compact }: Props) {
  const { isRtl, textAlign, writingDirection, row } = useLayout();
  const colors = useColors();

  return (
    <View style={[styles.sectionHead, row, compact && styles.compact]}>
      <View
        style={[
          styles.sectionIcon,
          compact && styles.iconCompact,
          { backgroundColor: colors.primarySoft },
        ]}
      >
        <Ionicons name={icon} size={compact ? 14 : 18} color={colors.primary} />
      </View>
      <Text
        style={[
          styles.sectionTitle,
          compact && styles.titleCompact,
          { textAlign, writingDirection, color: colors.primary },
          isRtl ? styles.titleRtl : null,
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
  },
  compact: { gap: 6 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompact: {
    width: 26,
    height: 26,
    borderRadius: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
  },
  titleCompact: { fontSize: 14 },
  titleRtl: { textAlign: 'right' },
});
