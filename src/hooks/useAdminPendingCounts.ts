import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/lib/auth';
import { supabase, uniqueChannel } from '@/src/lib/supabase';

export function useAdminPendingCounts() {
  const { profile } = useAuth();
  const [owners, setOwners] = useState(0);
  const [listings, setListings] = useState(0);
  const [bookings, setBookings] = useState(0);

  const refresh = useCallback(async () => {
    if (profile?.role !== 'admin') {
      setOwners(0);
      setListings(0);
      setBookings(0);
      return;
    }
    const [ownerRes, listingRes, bookingRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('owner_status', 'pending'),
      supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setOwners(ownerRes.error ? 0 : ownerRes.count ?? 0);
    setListings(listingRes.error ? 0 : listingRes.count ?? 0);
    setBookings(bookingRes.error ? 0 : bookingRes.count ?? 0);
  }, [profile?.role]);

  useEffect(() => {
    void refresh();
    if (profile?.role !== 'admin') return;
    const channel = uniqueChannel('admin-pending-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apartments' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.role, refresh]);

  return { owners, listings, bookings };
}
