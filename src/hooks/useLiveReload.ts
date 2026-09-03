import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';

import { usePullRefresh } from '@/src/hooks/usePullRefresh';
import { supabase, uniqueChannel } from '@/src/lib/supabase';

type LiveTable =
  | 'apartments'
  | 'bookings'
  | 'conversations'
  | 'messages'
  | 'profiles'
  | 'cities'
  | 'universities'
  | 'saved_apartments'
  | 'app_settings';

export function useLiveReload(load: () => Promise<void>, tables: readonly LiveTable[] = [], key = 'list') {
  const { refreshing, refresh } = usePullRefresh(load);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = tables.join('+');

  useFocusEffect(
    useCallback(() => {
      void load();

      const app = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });

      if (!tablesKey) {
        return () => app.remove();
      }

      const bump = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void load();
        }, 300);
      };

      const channel = tablesKey.split('+').reduce(
        (next, table) =>
          next.on('postgres_changes', { event: '*', schema: 'public', table }, bump),
        uniqueChannel(`live:${key}:${tablesKey}`),
      );
      channel.subscribe();

      return () => {
        app.remove();
        if (timer.current) clearTimeout(timer.current);
        void supabase.removeChannel(channel);
      };
    }, [key, load, tablesKey]),
  );

  return { refreshing, refresh };
}
