import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { SUPPORT_EMAIL } from '@/src/lib/support';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Kind = 'terms' | 'privacy';

export function LegalDocModal({
  kind,
  onClose,
}: {
  kind: Kind | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const title = kind === 'privacy' ? t('menu.privacy') : t('menu.terms');
  const body =
    kind === 'privacy'
      ? t('menu.privacyBody', { email: SUPPORT_EMAIL })
      : t('menu.termsBody', { email: SUPPORT_EMAIL });

  return (
    <Modal visible={Boolean(kind)} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay, paddingTop: insets.top + spacing.md }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, rtlText, { color: colors.primaryDark }]}>{title}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.copy, rtlText, { color: colors.text }]}>{body}</Text>
          </ScrollView>
          <Button title={t('common.close')} onPress={onClose} pill />
        </View>
      </View>
    </Modal>
  );
}

export function LegalAcceptRow({
  accepted,
  onToggle,
  onOpen,
}: {
  accepted: boolean;
  onToggle: () => void;
  onOpen: (kind: Kind) => void;
}) {
  const { t } = useTranslation();
  const { rtlText, isRtl, row } = useLayout();
  const colors = useColors();

  return (
    <View style={styles.acceptBlock}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        style={[styles.agreeRow, row]}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: accepted ? colors.primary : colors.border,
              backgroundColor: accepted ? colors.primary : colors.surface,
            },
          ]}
        >
          {accepted ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
        </View>
        <Text style={[styles.agreeText, rtlText, { color: colors.text }]}>{t('auth.acceptTerms')}</Text>
      </Pressable>
      <View style={[styles.links, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
        <Pressable onPress={() => onOpen('terms')} hitSlop={8}>
          <Text style={[styles.link, { color: colors.primary }]}>{t('menu.terms')}</Text>
        </Pressable>
        <Text style={{ color: colors.textMuted }}>·</Text>
        <Pressable onPress={() => onOpen('privacy')} hitSlop={8}>
          <Text style={[styles.link, { color: colors.primary }]}>{t('menu.privacy')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    maxHeight: '86%',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  scroll: { maxHeight: 420 },
  body: { paddingBottom: spacing.md },
  copy: { fontSize: 15, fontFamily: 'Cairo_400Regular', lineHeight: 24 },
  acceptBlock: { gap: 8 },
  agreeRow: { alignItems: 'flex-start', gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  agreeText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  link: { fontSize: 13, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
});
