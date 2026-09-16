import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/navigation/TabIcon';
import { useAdminPendingCounts } from '@/src/hooks/useAdminPendingCounts';
import { useUnreadChatCount } from '@/src/hooks/useUnreadChatCount';
import { useAppTabScreenOptions } from '@/src/theme/tabs';
import { useColors } from '@/src/theme/ThemeProvider';

function badge(count: number) {
  if (count <= 0) return undefined;
  return count > 9 ? '9+' : count;
}

export default function AdminTabs() {
  const { t } = useTranslation();
  const tabOptions = useAppTabScreenOptions();
  const colors = useColors();
  const pending = useAdminPendingCounts();
  const unreadChats = useUnreadChatCount();
  const badgeStyle = { backgroundColor: colors.warning, color: colors.white, fontSize: 10 };
  const usersBadge = badge(pending.owners + pending.ids);
  const settingsBadge = badge(pending.reports);

  return (
    <Tabs detachInactiveScreens={false} screenOptions={tabOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.overview'),
          tabBarBadge: badge(pending.owners + pending.ids + pending.listings + pending.bookings + pending.reports),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="grid-outline" filled="grid" />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t('tabs.users'),
          tabBarBadge: usersBadge,
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="people-outline" filled="people" />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: t('tabs.listings'),
          tabBarBadge: badge(pending.listings),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="home-outline" filled="home" />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('tabs.bookings'),
          tabBarBadge: badge(pending.bookings),
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="calendar-outline" filled="calendar" />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarBadge: unreadChats > 0 ? (unreadChats > 9 ? '9+' : unreadChats) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.white, fontSize: 10 },
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="chatbubbles-outline" filled="chatbubbles" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarBadge: settingsBadge,
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="person-outline" filled="person" />,
        }}
      />
    </Tabs>
  );
}
