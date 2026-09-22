import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConversationList, useInbox, type InboxFilter } from '@/components/ConversationList';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { loadOwnerOccupiedApartmentIds } from '@/src/lib/booking';
import { useColors } from '@/src/theme/ThemeProvider';

export default function OwnerChat() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const inbox = useInbox();
  const [filter, setFilter] = useState<InboxFilter>('inbox');
  const [occupiedIds, setOccupiedIds] = useState<string[]>([]);
  const { apartmentId } = useLocalSearchParams<{ apartmentId?: string }>();
  const listingId = typeof apartmentId === 'string' ? apartmentId : undefined;

  useEffect(() => {
    if (!inbox.profile?.id) {
      setOccupiedIds([]);
      return;
    }
    let alive = true;
    void loadOwnerOccupiedApartmentIds(inbox.profile.id)
      .then((ids) => {
        if (alive) setOccupiedIds(ids);
      })
      .catch(() => {
        if (alive) setOccupiedIds([]);
      });
    return () => {
      alive = false;
    };
  }, [inbox.profile?.id, inbox.items?.length]);

  return (
    <Screen
      onRefresh={() => void inbox.refresh()}
      refreshing={inbox.refreshing}
      back={Boolean(listingId)}
      onBack={() => router.setParams({ apartmentId: undefined })}
    >
      <ProfileEnter scene="chat" enterOnMount>
      <OfflineBanner />
      <View style={styles.top}>
        <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('chat.title')}</Text>
      </View>
      <ConversationList
        roleHref="/(owner)/conversation/[id]"
        items={inbox.items}
        profileId={inbox.profile?.id}
        isOwner
        onReload={inbox.reload}
        onPatch={inbox.patch}
        filter={filter}
        onFilterChange={setFilter}
        apartmentId={listingId}
        pinApartmentIds={occupiedIds}
      />
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: 0 },
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
});
