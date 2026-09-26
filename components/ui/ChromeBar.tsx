import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
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
  /** Hide the global language toggle (rare). */
  hideLanguage?: boolean;
};

export function ChromeBar({
  back = false,
  compactBack = false,
  showMenu,
  onBack,
  extra,
  hideLanguage = false,
}: Props) {
  const menu = showMenu ?? !back;
  useEdgeBack(Boolean(back), onBack ?? goBack);
  if (!back && !menu && !extra && hideLanguage) return null;

  return (
    <View style={[styles.bar, back || extra || !hideLanguage ? styles.spread : styles.end]}>
      {back ? <BackButton compact={compactBack} onPress={onBack} /> : null}
      <View style={styles.trail}>
        {extra}
        {hideLanguage ? null : <LanguageToggle />}
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
