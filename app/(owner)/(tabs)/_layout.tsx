import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabIcon } from '@/components/navigation/TabIcon';
import { usePendingBookingCount } from '@/src/hooks/usePendingBookingCount';
import { useUnreadChatCount } from '@/src/hooks/useUnreadChatCount';
import { useAppTabScreenOptions } from '@/src/theme/tabs';
import { useColors } from '@/src/theme/ThemeProvider';

export const unstable_settings = {
  initialRouteName: 'listings',
};

export default function OwnerTabs() {
  const { t } = useTranslation();
  const tabOptions = useAppTabScreenOptions();
  const colors = useColors();
  const unreadChats = useUnreadChatCount();
  const pendingBookings = usePendingBookingCount();

  return (
    <Tabs detachInactiveScreens={false} screenOptions={tabOptions}>
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
          tabBarBadge: pendingBookings > 0 ? (pendingBookings > 9 ? '9+' : pendingBookings) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.warning, color: colors.white, fontSize: 10 },
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
        name="earnings"
        options={{
          href: null,
          title: t('tabs.earnings'),
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
