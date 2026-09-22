import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useLayout } from '@/src/hooks/useLayout';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
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
  /** Runs when the toast body is tapped (not the X). */
  onPress?: () => void;
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
let boundHide: (() => void) | null = null;

export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  bound?.(title, message, buttons);
}

export function dismissNotices() {
  boundHide?.();
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

  const hideToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  };

  const hideDialog = () => setDialog(null);

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
        const tapAction = actions[0]?.onPress;
        setToast({
          title,
          message: body,
          tone: inferTone(title),
          onPress: tapAction,
        });
        toastTimer.current = setTimeout(() => {
          toastTimer.current = null;
          setToast(null);
        }, 4200);
      },
    }),
    [],
  );

  useEffect(() => {
    bound = api.alert;
    boundHide = () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = null;
      setToast(null);
      setDialog(null);
    };
    return () => {
      bound = null;
      boundHide = null;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [api]);

  return (
    <NoticeContext.Provider value={api}>
      <View style={styles.root}>
        {children}
        <NoticeHost toast={toast} dialog={dialog} onHideToast={hideToast} onHideDialog={hideDialog} />
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
  const { isRtl, textAlign, writingDirection, row } = useLayout();
  const colors = useColors();
  const safe = useModalSafeArea();
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
  const dialogBack = useEdgeBack(Boolean(dialog), onHideDialog);

  const pressToast = () => {
    const action = toast?.onPress;
    onHideToast();
    if (action) queueMicrotask(action);
  };

  return (
    <>
      {/* Only the toast chip captures taps; the rest of the screen stays usable */}
      <View style={styles.toastHost} pointerEvents="box-none">
        {toast ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastWrap,
              {
                top: safe.top + 12,
                opacity: slide,
                transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <View style={[styles.toast, row, { backgroundColor: palette.bg, borderColor: palette.tint, shadowColor: colors.text }]}>
              <Pressable onPress={pressToast} style={[styles.toastMain, row]} accessibilityRole="button">
                <Ionicons name={palette.icon} size={24} color={palette.tint} />
                <View style={styles.toastCopy}>
                  <Text style={[styles.toastTitle, rtlText, { color: palette.tint }]}>{toast.title}</Text>
                  {toast.message ? <Text style={[styles.toastBody, rtlText, { color: colors.text }]}>{toast.message}</Text> : null}
                  {toast.onPress ? (
                    <Text style={[styles.toastHint, rtlText, { color: palette.tint }]}>{i18n.t('common.toastTapHint')}</Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                onPress={onHideToast}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('common.close')}
                style={[styles.closeBtn, { backgroundColor: colors.surface }]}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <Modal visible={Boolean(dialog)} transparent animationType="fade" statusBarTranslucent onRequestClose={onHideDialog}>
        <View
          {...dialogBack}
          style={[
            styles.overlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: Math.max(safe.top, spacing.lg),
              paddingBottom: Math.max(safe.bottom, spacing.lg),
            },
          ]}
        >
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
  toastHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
  toastWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  toast: {
    alignItems: 'center',
    gap: 8,
    paddingLeft: spacing.md,
    paddingRight: 8,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  toastMain: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 10,
  },
  toastCopy: { flex: 1, minWidth: 0, gap: 2 },
  toastTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Cairo_700Bold',
  },
  toastBody: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 18,
  },
  toastHint: {
    fontSize: 11,
    fontFamily: 'Cairo_600SemiBold',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
