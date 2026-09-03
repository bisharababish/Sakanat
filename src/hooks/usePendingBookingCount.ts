import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/lib/auth';
import { supabase, uniqueChannel } from '@/src/lib/supabase';

export function usePendingBookingCount() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!profile?.id || profile.role !== 'owner') {
      setCount(0);
      return;
    }
    const { count: next, error } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', profile.id)
      .eq('status', 'pending');
    setCount(error ? 0 : next ?? 0);
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    void refresh();
    if (!profile?.id || profile.role !== 'owner') return;
    const channel = uniqueChannel(`pending-bookings:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, refresh]);

  return count;
}
