import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationList, useInbox, type InboxFilter } from '@/components/ConversationList';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { loadActiveStay } from '@/src/lib/booking';
import { useColors } from '@/src/theme/ThemeProvider';

export default function StudentChat() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const inbox = useInbox();
  const [filter, setFilter] = useState<InboxFilter>('inbox');
  const [stayApartmentId, setStayApartmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!inbox.profile?.id) {
      setStayApartmentId(null);
      return;
    }
    let alive = true;
    void loadActiveStay(inbox.profile.id)
      .then((stay) => {
        if (alive) setStayApartmentId(stay?.apartment_id ?? null);
      })
      .catch(() => {
        if (alive) setStayApartmentId(null);
      });
    return () => {
      alive = false;
    };
  }, [inbox.profile?.id, inbox.items?.length]);

  return (
    <Screen onRefresh={() => void inbox.refresh()} refreshing={inbox.refreshing}>
      <ProfileEnter scene="chat" enterOnMount>
      <OfflineBanner />
      <View style={styles.top}>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('chat.title')}</Text>
      </View>
      <ConversationList
        roleHref="/(student)/conversation/[id]"
        items={inbox.items}
        profileId={inbox.profile?.id}
        isOwner={false}
        onReload={inbox.reload}
        filter={filter}
        onFilterChange={setFilter}
        pinApartmentId={stayApartmentId ?? undefined}
      />
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: 0 },
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
});
