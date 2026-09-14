import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import {
  COPYRIGHT_YEAR,
  INSTAGRAM_HANDLE,
  instagramUrl,
  mailTo,
  supportWhatsAppUrl,
} from '@/src/lib/support';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function AppBrandFooter() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();

  const openInstagram = () => {
    void Linking.openURL(instagramUrl());
  };

  const openWhatsApp = () => {
    const url = supportWhatsAppUrl(t('menu.whatsappPrefill'));
    if (url) {
      void Linking.openURL(url);
      return;
    }
    alert(t('menu.whatsapp'), t('menu.whatsappMissing'));
    void Linking.openURL(mailTo(t('menu.supportSubject')));
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.links, row]}>
        <Pressable
          onPress={openInstagram}
          hitSlop={8}
          style={[styles.link, row]}
          accessibilityRole="link"
          accessibilityLabel={t('menu.instagram')}
        >
          <Ionicons name="logo-instagram" size={16} color={colors.primary} />
          <Text style={[styles.linkText, rtlText, { color: colors.primary }]}>@{INSTAGRAM_HANDLE}</Text>
        </Pressable>
        <Text style={[styles.dot, { color: colors.border }]}>·</Text>
        <Pressable
          onPress={openWhatsApp}
          hitSlop={8}
          style={[styles.link, row]}
          accessibilityRole="link"
          accessibilityLabel={t('menu.whatsapp')}
        >
          <Ionicons name="logo-whatsapp" size={16} color={colors.primary} />
          <Text style={[styles.linkText, rtlText, { color: colors.primary }]}>{t('menu.whatsapp')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.copy, rtlText, { color: colors.textMuted }]}>
        {t('menu.copyright', { year: COPYRIGHT_YEAR })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, paddingTop: spacing.sm, paddingBottom: spacing.md },
  links: { alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  link: { alignItems: 'center', gap: 6 },
  linkText: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  dot: { fontSize: 16, lineHeight: 18 },
  copy: { fontSize: 11, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
});
