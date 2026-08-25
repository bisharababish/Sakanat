import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/navigation/TabIcon';
import { appTabScreenOptions } from '@/src/theme/tabs';

export default function AdminTabs() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={appTabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.overview'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="grid-outline" filled="grid" />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t('tabs.users'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="people-outline" filled="people" />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: t('tabs.listings'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="home-outline" filled="home" />,
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
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="settings-outline" filled="settings" />,
        }}
      />
    </Tabs>
  );
}
