import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConversationList, useInbox, type InboxFilter } from '@/components/ConversationList';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { Screen } from '@/components/ui/Screen';
import { TabPageHeader } from '@/components/ui/TabPageHeader';
import { loadOwnerOccupiedApartmentIds } from '@/src/lib/booking';

export default function OwnerChat() {
  const { t } = useTranslation();
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
        <TabPageHeader kicker={t('tabs.chat')} title={t('chat.title')} />
        <ConversationList
          roleHref="/(owner)/conversation/[id]"
          items={inbox.items}
          loadError={inbox.loadError}
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
