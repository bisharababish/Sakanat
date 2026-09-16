import { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useEdgeBack } from '@/src/hooks/useEdgeBack';
import { useModalSafeArea } from '@/src/hooks/useModalSafeArea';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function NoteModal({
  visible,
  title,
  label,
  hint,
  value,
  confirmTitle,
  loading,
  presets,
  onChange,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  label: string;
  hint?: string;
  value: string;
  confirmTitle: string;
  loading?: boolean;
  presets?: string[];
  onChange: (next: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const safe = useModalSafeArea();
  const [kb, setKb] = useState(0);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const submit = () => {
    Keyboard.dismiss();
    onConfirm();
  };

  const edgeBack = useEdgeBack(visible, close);

  useEffect(() => {
    if (!visible) {
      setKb(0);
      return;
    }
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      setKb(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View
        {...edgeBack}
        style={[
          styles.overlay,
          {
            backgroundColor: colors.overlay,
            paddingTop: Math.max(safe.top, spacing.md),
            paddingBottom: kb > 0 ? Math.max(kb, spacing.sm) : Math.max(safe.bottom, spacing.md),
          },
        ]}
      >
        <Pressable style={styles.dismiss} onPress={Keyboard.dismiss} accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{title}</Text>
          {presets && presets.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.presets, row]}>
              {presets.map((item) => {
                const on = value === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => onChange(item)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colors.dangerSoft : colors.surfaceMuted,
                        borderColor: on ? colors.danger : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: on ? colors.danger : colors.text }]} numberOfLines={1}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
            style={styles.noteScroll}
          >
            <Input label={label} value={value} onChangeText={onChange} hint={hint} multiline />
          </ScrollView>
          <Button title={confirmTitle} variant="danger" pill loading={loading} onPress={submit} />
          <Button title={t('common.cancel')} variant="ghost" pill onPress={close} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  dismiss: { flex: 1 },
  sheet: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    zIndex: 1,
    maxHeight: '86%',
  },
  title: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  presets: { gap: 8, paddingVertical: 2 },
  noteScroll: { flexGrow: 0, maxHeight: 180 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 220,
  },
  chipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
});
