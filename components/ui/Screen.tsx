import type { ReactNode, RefObject } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/OfflineBanner';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showMenu?: boolean;
  back?: boolean;
  onBack?: () => void;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollRef?: RefObject<ScrollView | null>;
};

export function Screen({
  children,
  scroll = true,
  showMenu,
  back = false,
  onBack,
  footer,
  refreshing = false,
  onRefresh,
  scrollRef,
}: Props) {
  const colors = useColors();
  const bar = <ChromeBar back={back} showMenu={showMenu ?? !back} onBack={onBack} />;
  const bottom = footer ? (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}
    >
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

  const content = (
    <>
      <OfflineBanner />
      {children}
    </>
  );

  const body = (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[styles.pad, footer ? styles.padWithFooter : null]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      bounces
      alwaysBounceVertical={Boolean(onRefresh)}
      overScrollMode={onRefresh ? 'always' : 'auto'}
      nestedScrollEnabled
      refreshControl={refreshControl}
    >
      {content}
    </ScrollView>
  );

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        {bar}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={[styles.pad, styles.flex]}>{content}</View>
          {bottom}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {bar}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {body}
        {bottom}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  pad: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  padWithFooter: { paddingBottom: spacing.md },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
