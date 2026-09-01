import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/navigation/TabIcon';
import { useUnreadChatCount } from '@/src/hooks/useUnreadChatCount';
import { useAppTabScreenOptions } from '@/src/theme/tabs';
import { useColors } from '@/src/theme/ThemeProvider';

export const unstable_settings = {
  initialRouteName: 'search',
};

export default function StudentTabs() {
  const { t } = useTranslation();
  const tabOptions = useAppTabScreenOptions();
  const colors = useColors();
  const unreadChats = useUnreadChatCount();

  return (
    <Tabs screenOptions={tabOptions}>
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="search-outline" filled="search" />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('tabs.bookings'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="calendar-outline" filled="calendar" />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarBadge: unreadChats > 0 ? (unreadChats > 9 ? '9+' : unreadChats) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.white, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="chatbubbles-outline" filled="chatbubbles" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="person-outline" filled="person" />,
        }}
      />
    </Tabs>
  );
}
