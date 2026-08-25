import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
};

export function SectionHead({ icon, title }: Props) {
  const { isRtl, textAlign, writingDirection } = useLayout();
  const colors = useColors();

  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text
        style={[
          styles.sectionTitle,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
  },
  titleRtl: { textAlign: 'right' },
});
