import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import i18n from '@/src/i18n';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type Tone = 'success' | 'error' | 'info';

type ToastState = {
  title: string;
  message: string;
  tone: Tone;
};

type DialogState = {
  title: string;
  message: string;
  buttons: AlertButton[];
};

type NoticeApi = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => void;
};

const NoticeContext = createContext<NoticeApi>({ alert: () => {} });

let bound: NoticeApi['alert'] | null = null;

export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  bound?.(title, message, buttons);
}

function inferTone(title: string): Tone {
  if (title === i18n.t('common.error')) return 'error';
  if (title === i18n.t('common.done') || title === i18n.t('booking.success')) return 'success';
  return 'info';
}

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useMemo<NoticeApi>(
    () => ({
      alert: (title, message, buttons) => {
        const actions = (buttons ?? []).filter(Boolean);
        const body = message ?? '';
        if (actions.length >= 2) {
          setDialog({ title, message: body, buttons: actions });
          return;
        }
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ title, message: body, tone: inferTone(title) });
        toastTimer.current = setTimeout(() => setToast(null), 2800);
        const followUp = actions[0]?.onPress;
        if (followUp) queueMicrotask(followUp);
      },
    }),
    [],
  );

  useEffect(() => {
    bound = api.alert;
    return () => {
      bound = null;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [api]);

  return (
    <NoticeContext.Provider value={api}>
      <View style={styles.root}>
        {children}
        <NoticeHost toast={toast} dialog={dialog} onHideToast={() => setToast(null)} onHideDialog={() => setDialog(null)} />
      </View>
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  return useContext(NoticeContext);
}

function NoticeHost({
  toast,
  dialog,
  onHideToast,
  onHideDialog,
}: {
  toast: ToastState | null;
  dialog: DialogState | null;
  onHideToast: () => void;
  onHideDialog: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { isRtl, textAlign, writingDirection } = useLayout();
  const colors = useColors();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: toast ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [slide, toast]);

  const palette = {
    success: { bg: colors.successSoft, icon: 'checkmark-circle' as const, tint: colors.success },
    error: { bg: colors.dangerSoft, icon: 'close-circle' as const, tint: colors.danger },
    info: { bg: colors.accentSoft, icon: 'information-circle' as const, tint: colors.primary },
  }[toast?.tone ?? 'info'];

  const rtlText = { textAlign, writingDirection } as const;

  return (
    <>
      {toast ? (
        <View pointerEvents="box-none" style={styles.host}>
          <Animated.View
            style={[
              styles.toastWrap,
              { top: insets.top + 8, opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
            ]}
          >
            <Pressable onPress={onHideToast} style={[styles.toast, { backgroundColor: palette.bg, borderColor: palette.tint, shadowColor: colors.text }]}>
              {isRtl ? null : <Ionicons name={palette.icon} size={26} color={palette.tint} />}
              <View style={styles.toastCopy}>
                <Text style={[styles.toastTitle, rtlText, { color: palette.tint }]}>{toast.title}</Text>
                {toast.message ? <Text style={[styles.toastBody, rtlText, { color: colors.text }]}>{toast.message}</Text> : null}
              </View>
              {isRtl ? <Ionicons name={palette.icon} size={26} color={palette.tint} /> : null}
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      <Modal visible={Boolean(dialog)} transparent animationType="fade" statusBarTranslucent onRequestClose={onHideDialog}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onHideDialog} />
          {dialog ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.dialogTitle, rtlText, { color: colors.primaryDark }]}>{dialog.title}</Text>
              {dialog.message ? <Text style={[styles.dialogBody, rtlText, { color: colors.textMuted }]}>{dialog.message}</Text> : null}
              <View style={styles.actions}>
                {dialog.buttons.map((button, index) => {
                  const variant =
                    button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'ghost' : 'primary';
                  return (
                    <Button
                      key={`${button.text}-${index}`}
                      title={button.text}
                      variant={variant}
                      onPress={() => {
                        onHideDialog();
                        button.onPress?.();
                      }}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  toastWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  toastCopy: { flex: 1, minWidth: 0, gap: 2 },
  toastTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Cairo_700Bold',
  },
  toastBody: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    zIndex: 1,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
  },
  dialogBody: {
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 24,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
