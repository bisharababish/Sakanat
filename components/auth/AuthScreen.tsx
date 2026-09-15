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
  onBack?: () => void;
  center?: boolean;
  scroll?: boolean;
};

export function AuthScreen({ children, footer, back = false, onBack, center = true, scroll = true }: Props) {
  const colors = useColors();
  const body = (
    <>
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <ChromeBar back={back} showMenu={false} onBack={onBack} />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={[styles.content, center ? styles.center : styles.start]}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, styles.fit, center ? styles.center : styles.fitStart]}>{body}</View>
      )}
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
  fit: {
    gap: spacing.sm,
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  fitStart: { justifyContent: 'space-between' },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
