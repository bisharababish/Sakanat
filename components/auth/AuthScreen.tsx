import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/LanguageToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
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
  language?: boolean;
};

const KB_OFFSET_IOS = 8;
const KB_OFFSET_ANDROID = 0;

export function AuthScreen({ children, footer, back = false, onBack, center = true, scroll = true, language = false }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const body = (
    <>
      <OfflineBanner />
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  const scrolled = (
    <ScrollView
      style={styles.flex}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[
        styles.content,
        center ? styles.center : styles.start,
        { paddingBottom: spacing.lg + Math.max(insets.bottom, 8) },
      ]}
      showsVerticalScrollIndicator
      bounces
    >
      {body}
    </ScrollView>
  );

  const staticBody = (
    <View style={[styles.flex, styles.content, styles.fit, center ? styles.center : styles.fitStart]}>{body}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <ChromeBar back={back} showMenu={false} onBack={onBack} extra={language ? <LanguageToggle /> : undefined} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? KB_OFFSET_IOS : KB_OFFSET_ANDROID}
      >
        {scroll ? scrolled : staticBody}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  center: { justifyContent: 'center' },
  start: { justifyContent: 'flex-start', paddingTop: 0 },
  fit: {
    gap: spacing.sm,
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  fitStart: { justifyContent: 'space-between' },
  footer: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: spacing.sm,
  },
});
