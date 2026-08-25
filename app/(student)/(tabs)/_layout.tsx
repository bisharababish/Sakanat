import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/navigation/TabIcon';
import { appTabScreenOptions } from '@/src/theme/tabs';

export const unstable_settings = {
  initialRouteName: 'search',
};

export default function StudentTabs() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={appTabScreenOptions}>
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
