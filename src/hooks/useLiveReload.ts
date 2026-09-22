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
  | 'apartment_reviews'
  | 'app_settings'
  | 'app_reports';

/**
 * Live reload while the screen is focused (Supabase realtime) + pull-to-refresh.
 * Also reloads on focus and when the app returns to the foreground.
 */
export function useLiveReload(
  load: () => Promise<void>,
  tables: readonly LiveTable[] = [],
  key = 'list',
  pull?: () => Promise<void>,
) {
  const { refreshing, refresh } = usePullRefresh(pull ?? load);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = tables.join('+');
  const loadRef = useRef(load);
  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      void loadRef.current();

      const app = AppState.addEventListener('change', (state) => {
        if (state === 'active') void loadRef.current();
      });

      if (!tablesKey) {
        return () => app.remove();
      }

      const bump = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          void loadRef.current();
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
    }, [key, tablesKey]),
  );

  return { refreshing, refresh };
}
