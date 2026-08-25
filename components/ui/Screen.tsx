import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu/MenuButton';
import { BackButton } from '@/components/ui/BackButton';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showMenu?: boolean;
  back?: boolean;
};

export function Screen({ children, scroll = true, showMenu = true, back = false }: Props) {
  const colors = useColors();
  const bar =
    back || showMenu ? (
      <View style={[styles.langBar, back ? styles.topRow : styles.menuOnly]}>
        {back ? <BackButton /> : null}
        {showMenu ? <MenuButton /> : null}
      </View>
    ) : null;

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        {bar}
        <View style={styles.pad}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {bar}
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  langBar: {
    direction: 'ltr',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pad: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, paddingTop: spacing.md },
});
