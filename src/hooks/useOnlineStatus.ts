import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/src/lib/supabase';

/** Lightweight online check via Supabase (no extra native module). */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  const check = useCallback(async () => {
    try {
      const result = await Promise.race([
        supabase.from('cities').select('id').limit(1),
        new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ error: { message: 'Network request failed' } }), 4000),
        ),
      ]);
      const message = result.error?.message ?? '';
      setOnline(!/network|failed to fetch|timeout|abort/i.test(message));
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const interval = setInterval(() => void check(), 30000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [check]);

  return { online, refreshOnline: check };
}
