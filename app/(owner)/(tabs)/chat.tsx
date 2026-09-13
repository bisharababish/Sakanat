import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationList, useInbox, type InboxFilter } from '@/components/ConversationList';
import { OfflineBanner } from '@/components/OfflineBanner';
import { HubRow } from '@/components/ui/HubRow';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { isConversationUnread } from '@/src/lib/chat';
import { useColors } from '@/src/theme/ThemeProvider';

export default function OwnerChat() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const inbox = useInbox();
  const unread = inbox.items?.filter((item) => isConversationUnread(item, inbox.profile?.id)).length ?? 0;
  const [filter, setFilter] = useState<InboxFilter>('inbox');

  return (
    <Screen onRefresh={() => void inbox.refresh()} refreshing={inbox.refreshing}>
      <OfflineBanner />
      <View style={styles.top}>
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.chat')}</Text>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('chat.title')}</Text>
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('chat.inboxHint')}</Text>
      </View>
      <HubRow
        icon="mail-unread-outline"
        label={t('chat.filterUnread')}
        hint={t('profile.itemCount', { count: unread })}
        dot={unread > 0}
        onPress={() => setFilter((current) => (current === 'unread' ? 'inbox' : 'unread'))}
      />
      <ConversationList
        roleHref="/(owner)/conversation/[id]"
        items={inbox.items}
        profileId={inbox.profile?.id}
        isOwner
        onReload={inbox.reload}
        filter={filter}
        onFilterChange={setFilter}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: 2 },
  kicker: { fontSize: 11, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', marginBottom: -2 },
  title: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular' },
});
