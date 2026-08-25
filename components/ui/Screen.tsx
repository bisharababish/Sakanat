import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/BackButton';
import { LanguageToggle } from '@/components/LanguageToggle';
import { colors, spacing } from '@/src/theme/colors';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showLanguage?: boolean;
  back?: boolean;
};

export function Screen({ children, scroll = true, showLanguage = true, back = false }: Props) {
  const bar =
    back || showLanguage ? (
      <View style={[styles.langBar, back ? styles.topRow : styles.langOnly]}>
        {back ? <BackButton /> : null}
        {showLanguage ? <LanguageToggle /> : null}
      </View>
    ) : null;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {bar}
        <View style={styles.pad}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {bar}
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  langBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langOnly: {
    alignItems: 'flex-start',
  },
  pad: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, paddingTop: spacing.md },
});
