import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChromeBar } from '@/components/ui/ChromeBar';
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
  const bar = <ChromeBar back={back} showMenu={showMenu} />;

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
  pad: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, paddingTop: spacing.md },
});
