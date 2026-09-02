import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationList, useInbox } from '@/components/ConversationList';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useColors } from '@/src/theme/ThemeProvider';

export default function StudentChat() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const inbox = useInbox();

  return (
    <Screen onRefresh={() => void inbox.refresh()} refreshing={inbox.refreshing}>
      <View style={styles.top}>
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.chat')}</Text>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('chat.title')}</Text>
      </View>
      <ConversationList
        roleHref="/(student)/conversation/[id]"
        items={inbox.items}
        profileId={inbox.profile?.id}
        isOwner={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginBottom: -4 },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
});
