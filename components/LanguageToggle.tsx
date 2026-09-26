import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { changeAppLanguage } from '@/src/i18n';
import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  onDark?: boolean;
};

export function LanguageToggle({ onDark }: Props) {
  const { t } = useTranslation();
  const { lang } = useLayout();
  const { profile } = useAuth();
  const colors = useColors();

  const setLang = async (next: 'ar' | 'en') => {
    if (next === lang) return;
    await changeAppLanguage(next);
    if (profile?.id) {
      void supabase.from('profiles').update({ language: next }).eq('id', profile.id);
    }
  };

  return (
    <View
      style={[
        styles.wrap,
        onDark
          ? styles.wrapDark
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityRole="tablist"
    >
      <Pressable
        onPress={() => void setLang('ar')}
        hitSlop={8}
        accessibilityRole="tab"
        accessibilityState={{ selected: lang === 'ar' }}
        accessibilityLabel={t('common.arabic')}
        style={[styles.btn, lang === 'ar' && { backgroundColor: onDark ? colors.accent : colors.primary }]}
      >
        <Text
          style={[
            styles.label,
            { color: onDark ? 'rgba(255,255,255,0.78)' : colors.textMuted },
            lang === 'ar' && { color: onDark ? colors.primaryDark : colors.white },
          ]}
        >
          {t('common.arabic')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void setLang('en')}
        hitSlop={8}
        accessibilityRole="tab"
        accessibilityState={{ selected: lang === 'en' }}
        accessibilityLabel={t('common.english')}
        style={[styles.btn, lang === 'en' && { backgroundColor: onDark ? colors.accent : colors.primary }]}
      >
        <Text
          style={[
            styles.label,
            { color: onDark ? 'rgba(255,255,255,0.78)' : colors.textMuted },
            lang === 'en' && { color: onDark ? colors.primaryDark : colors.white },
          ]}
        >
          {t('common.english')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    direction: 'ltr',
    flexShrink: 0,
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
  },
  btn: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapDark: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'transparent',
  },
  label: { fontWeight: '700', fontSize: 12, fontFamily: 'Cairo_700Bold' },
});
