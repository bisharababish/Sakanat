import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/navigation/TabIcon';
import { useAppTabScreenOptions } from '@/src/theme/tabs';

export const unstable_settings = {
  initialRouteName: 'search',
};

export default function GuestTabs() {
  const { t } = useTranslation();
  const tabOptions = useAppTabScreenOptions();

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
        name="account"
        options={{
          title: t('guest.accountTitle'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} outline="person-outline" filled="person" />,
        }}
      />
    </Tabs>
  );
}
