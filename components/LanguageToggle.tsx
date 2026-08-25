import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/src/hooks/useLayout';
import { changeAppLanguage } from '@/src/i18n';
import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';
import { colors, radius } from '@/src/theme/colors';

type Props = {
  onDark?: boolean;
};

export function LanguageToggle({ onDark }: Props) {
  const { lang } = useLayout();
  const { profile } = useAuth();

  const setLang = async (next: 'ar' | 'en') => {
    if (next === lang) return;
    await changeAppLanguage(next);
    if (profile) {
      await supabase.from('profiles').update({ language: next }).eq('id', profile.id);
    }
  };

  return (
    <View style={[styles.wrap, onDark ? styles.wrapDark : null]}>
      <Pressable
        onPress={() => void setLang('ar')}
        hitSlop={12}
        style={[styles.btn, lang === 'ar' && (onDark ? styles.activeDark : styles.active)]}>
        <Text style={[styles.label, onDark && styles.labelDark, lang === 'ar' && (onDark ? styles.activeLabelDark : styles.activeLabel)]}>
          ع
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void setLang('en')}
        hitSlop={12}
        style={[styles.btn, lang === 'en' && (onDark ? styles.activeDark : styles.active)]}>
        <Text style={[styles.label, onDark && styles.labelDark, lang === 'en' && (onDark ? styles.activeLabelDark : styles.activeLabel)]}>
          EN
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
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
  active: { backgroundColor: colors.primary },
  activeDark: { backgroundColor: colors.accent },
  label: { fontWeight: '800', fontSize: 12, color: colors.textMuted },
  labelDark: { color: 'rgba(255,255,255,0.78)' },
  activeLabel: { color: colors.white },
  activeLabelDark: { color: colors.primaryDark },
});
