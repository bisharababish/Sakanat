import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/navigation/TabIcon';
import { useAppTabScreenOptions } from '@/src/theme/tabs';

export const unstable_settings = {
  initialRouteName: 'listings',
};

export default function OwnerTabs() {
  const { t } = useTranslation();
  const tabOptions = useAppTabScreenOptions();

  return (
    <Tabs screenOptions={tabOptions}>
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
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} outline="chatbubbles-outline" filled="chatbubbles" />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t('tabs.earnings'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="cash-outline" filled="cash" />,
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
