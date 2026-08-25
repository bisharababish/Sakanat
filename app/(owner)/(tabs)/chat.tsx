import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationList } from '@/components/ConversationList';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export default function OwnerChat() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('chat.title')}</Text>
      <ConversationList roleHref="/(owner)/conversation/[id]" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
});
