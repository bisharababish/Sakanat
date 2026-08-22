import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { changeAppLanguage } from '@/src/i18n';
import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';
import { colors, radius } from '@/src/theme/colors';

export function LanguageToggle() {
  const { t } = useTranslation();
  const { lang, row } = useLayout();
  const { profile } = useAuth();

  const setLang = async (next: 'ar' | 'en') => {
    await changeAppLanguage(next);
    if (profile) {
      await supabase.from('profiles').update({ language: next }).eq('id', profile.id);
    }
  };

  return (
    <View style={[styles.wrap, row]}>
      <Pressable onPress={() => setLang('ar')} style={[styles.btn, lang === 'ar' && styles.active]}>
        <Text style={[styles.label, lang === 'ar' && styles.activeLabel]}>{t('common.arabic')}</Text>
      </Pressable>
      <Pressable onPress={() => setLang('en')} style={[styles.btn, lang === 'en' && styles.active]}>
        <Text style={[styles.label, lang === 'en' && styles.activeLabel]}>{t('common.english')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceMuted, borderRadius: radius.full, padding: 4, alignSelf: 'flex-start' },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  active: { backgroundColor: colors.primary },
  label: { fontWeight: '700', color: colors.text },
  activeLabel: { color: colors.white },
});
