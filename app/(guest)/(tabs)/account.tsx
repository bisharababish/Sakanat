import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LegalDocModal } from '@/components/LegalDocModal';
import { LanguageToggle } from '@/components/LanguageToggle';
import { FaqList } from '@/components/menu/FaqList';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { openLogin, openRegister } from '@/src/lib/guest';
import { useColors } from '@/src/theme/ThemeProvider';

type Pane = 'home' | 'faq';

export default function GuestAccount() {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { reload } = useCatalog();
  const [pane, setPane] = useState<Pane>('home');
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const load = useCallback(async () => {
    reload();
  }, [reload]);
  const { refreshing, refresh } = useLiveReload(load, ['cities', 'universities'], 'guest-account');

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      back={pane !== 'home'}
      onBack={() => setPane('home')}
    >
      {pane === 'faq' ? (
        <>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('menu.faqTitle')}</Text>
          <FaqList />
        </>
      ) : (
        <ProfileEnter scene="guest">
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('guest.accountTitle')}</Text>
          <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('guest.accountBody')}</Text>
          <Card compact>
            <View style={[styles.langRow, row]}>
              <Text style={[styles.langLabel, rtlText, { color: colors.text }]}>{t('common.language')}</Text>
              <LanguageToggle />
            </View>
          </Card>
          <ProfileMenu
            links={[
              {
                key: 'login',
                icon: 'log-in-outline',
                label: t('auth.login'),
                onPress: openLogin,
              },
              {
                key: 'register',
                icon: 'person-add-outline',
                label: t('auth.register'),
                onPress: openRegister,
              },
              {
                key: 'faq',
                icon: 'help-circle-outline',
                label: t('menu.faqTitle'),
                onPress: () => setPane('faq'),
              },
              {
                key: 'terms',
                icon: 'document-text-outline',
                label: t('menu.terms'),
                onPress: () => setLegal('terms'),
              },
              {
                key: 'privacy',
                icon: 'shield-outline',
                label: t('menu.privacy'),
                onPress: () => setLegal('privacy'),
              },
            ]}
          />
        </ProfileEnter>
      )}
      <LegalDocModal kind={legal} onClose={() => setLegal(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  body: { fontSize: 15, lineHeight: 24, fontFamily: 'Cairo_400Regular' },
  langRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  langLabel: { flex: 1, fontSize: 14, fontFamily: 'Cairo_700Bold' },
});
