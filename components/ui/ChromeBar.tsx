import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/menu/MenuButton';
import { BackButton, goBack } from '@/components/ui/BackButton';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { spacing } from '@/src/theme/colors';

type Props = {
  back?: boolean;
  compactBack?: boolean;
  showMenu?: boolean;
  onBack?: () => void;
  extra?: ReactNode;
};

export function ChromeBar({ back = false, compactBack = false, showMenu, onBack, extra }: Props) {
  const menu = showMenu ?? !back;
  useEdgeBack(Boolean(back), onBack ?? goBack);
  if (!back && !menu && !extra) return null;

  if (extra) {
    return (
      <View style={[styles.bar, styles.split]}>
        <View style={[styles.slot, styles.slotStart]}>{back ? <BackButton compact={compactBack} onPress={onBack} /> : null}</View>
        <View style={styles.mid}>{extra}</View>
        <View style={[styles.slot, styles.slotEnd]}>{menu ? <MenuButton /> : null}</View>
      </View>
    );
  }

  return (
    <View style={[styles.bar, back ? styles.spread : styles.end]}>
      {back ? <BackButton compact={compactBack} onPress={onBack} /> : null}
      <View style={styles.trail}>
        {menu ? <MenuButton /> : null}
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
  split: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slot: { flex: 1, minWidth: 0 },
  slotStart: { alignItems: 'flex-start' },
  slotEnd: { alignItems: 'flex-end' },
  mid: { alignItems: 'center', justifyContent: 'center' },
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
