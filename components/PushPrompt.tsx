import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSegments } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { getNotificationStatus, markPushPrompted, requestPushAndRegister, wasPushPrompted } from '@/src/lib/push';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function PushPrompt() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const { profile } = useAuth();
  const colors = useColors();
  const segments = useSegments();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const inApp = ['(student)', '(owner)', '(admin)'].includes(String(segments[0] ?? ''));

  useEffect(() => {
    if (!profile?.id || Platform.OS === 'web' || !inApp) {
      setVisible(false);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      void (async () => {
        const status = await getNotificationStatus();
        if (!alive) return;
        if (status !== 'undetermined') return;
        if (await wasPushPrompted()) return;
        setVisible(true);
      })();
    }, 700);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [profile?.id, inApp]);

  const finish = async (allow: boolean) => {
    if (!profile?.id || busy) return;
    setBusy(true);
    try {
      await markPushPrompted();
      if (allow) await requestPushAndRegister(profile.id);
    } finally {
      setBusy(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => void finish(false)}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => void finish(false)} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="notifications" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{t('push.askTitle')}</Text>
          <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('push.askBody')}</Text>
          <Button title={t('push.allow')} onPress={() => void finish(true)} loading={busy} pill />
          <Button title={t('push.notNow')} variant="ghost" onPress={() => void finish(false)} disabled={busy} pill />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'stretch',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', textAlign: 'center' },
  body: { fontSize: 15, fontFamily: 'Cairo_400Regular', lineHeight: 24, textAlign: 'center', marginBottom: 8 },
});
