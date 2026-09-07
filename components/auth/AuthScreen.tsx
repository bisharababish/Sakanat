import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChromeBar } from '@/components/ui/ChromeBar';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  back?: boolean;
  center?: boolean;
};

export function AuthScreen({ children, footer, back = false, center = true }: Props) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <ChromeBar back={back} />
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[styles.content, center ? styles.center : styles.start]}
        showsVerticalScrollIndicator={false}
      >
        {children}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  center: { justifyContent: 'center' },
  start: { justifyContent: 'flex-start', paddingTop: spacing.sm },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
