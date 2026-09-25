import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConversationList, useInbox, type InboxFilter } from '@/components/ConversationList';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { Screen } from '@/components/ui/Screen';
import { TabPageHeader } from '@/components/ui/TabPageHeader';
import { loadActiveStay } from '@/src/lib/booking';

export default function StudentChat() {
  const { t } = useTranslation();
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
        <TabPageHeader kicker={t('tabs.chat')} title={t('chat.title')} />
        <ConversationList
          roleHref="/(student)/conversation/[id]"
          items={inbox.items}
          loadError={inbox.loadError}
          profileId={inbox.profile?.id}
          isOwner={false}
          onReload={inbox.reload}
          onPatch={inbox.patch}
          filter={filter}
          onFilterChange={setFilter}
          pinApartmentId={stayApartmentId ?? undefined}
        />
      </ProfileEnter>
    </Screen>
  );
}
