import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  const { lang } = useLayout();
  const { profile } = useAuth();
  const colors = useColors();

  const setLang = async (next: 'ar' | 'en') => {
    if (next === lang) return;
    await changeAppLanguage(next);
    if (profile) {
      await supabase.from('profiles').update({ language: next }).eq('id', profile.id);
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
    >
      <Pressable
        onPress={() => void setLang('ar')}
        hitSlop={12}
        style={[styles.btn, lang === 'ar' && { backgroundColor: onDark ? colors.accent : colors.primary }]}
      >
        <Text
          style={[
            styles.label,
            { color: onDark ? 'rgba(255,255,255,0.78)' : colors.textMuted },
            lang === 'ar' && { color: onDark ? colors.primaryDark : colors.white },
          ]}
        >
          ع
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void setLang('en')}
        hitSlop={12}
        style={[styles.btn, lang === 'en' && { backgroundColor: onDark ? colors.accent : colors.primary }]}
      >
        <Text
          style={[
            styles.label,
            { color: onDark ? 'rgba(255,255,255,0.78)' : colors.textMuted },
            lang === 'en' && { color: onDark ? colors.primaryDark : colors.white },
          ]}
        >
          EN
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
    minWidth: 36,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapDark: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'transparent',
  },
  label: { fontWeight: '800', fontSize: 12 },
});
