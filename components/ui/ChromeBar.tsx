import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { BackButton } from '@/components/ui/BackButton';
import { spacing } from '@/src/theme/colors';

type Props = {
  back?: boolean;
  compactBack?: boolean;
  showMenu?: boolean;
  extra?: ReactNode;
};

export function ChromeBar({ back = false, compactBack = false, showMenu = true, extra }: Props) {
  if (!back && !showMenu && !extra) return null;

  return (
    <View style={[styles.bar, back ? styles.spread : styles.end]}>
      {back ? <BackButton compact={compactBack} /> : null}
      <View style={styles.trail}>
        {extra}
        {showMenu ? <MenuButton /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    direction: 'ltr',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  spread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  end: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  trail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
