import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChromeBar } from '@/components/ui/ChromeBar';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showMenu?: boolean;
  back?: boolean;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({
  children,
  scroll = true,
  showMenu = true,
  back = false,
  footer,
  refreshing = false,
  onRefresh,
}: Props) {
  const colors = useColors();
  const bar = <ChromeBar back={back} showMenu={showMenu} />;
  const bottom = footer ? (
    <SafeAreaView edges={['bottom']} style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      {footer}
    </SafeAreaView>
  ) : null;
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  ) : undefined;

  const body = (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.pad, footer ? styles.padWithFooter : null]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      bounces
      alwaysBounceVertical={Boolean(onRefresh)}
      overScrollMode={onRefresh ? 'always' : 'auto'}
      nestedScrollEnabled
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        {bar}
        <View style={styles.pad}>{children}</View>
        {bottom}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {bar}
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {body}
          {bottom}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {bottom}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  pad: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  padWithFooter: { paddingBottom: spacing.md },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
