import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/lib/auth';
import { supabase, uniqueChannel } from '@/src/lib/supabase';

export function useAdminPendingCounts() {
  const { profile } = useAuth();
  const [owners, setOwners] = useState(0);
  const [listings, setListings] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [ids, setIds] = useState(0);
  const [reports, setReports] = useState(0);

  const refresh = useCallback(async () => {
    if (profile?.role !== 'admin') {
      setOwners(0);
      setListings(0);
      setBookings(0);
      setIds(0);
      setReports(0);
      return;
    }
    const [ownerRes, listingRes, bookingRes, idRes, reportRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('owner_status', 'pending'),
      supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('id_verify_status', 'pending'),
      supabase
        .from('app_reports')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'reviewing']),
    ]);
    setOwners(ownerRes.error ? 0 : ownerRes.count ?? 0);
    setListings(listingRes.error ? 0 : listingRes.count ?? 0);
    setBookings(bookingRes.error ? 0 : bookingRes.count ?? 0);
    setIds(idRes.error ? 0 : idRes.count ?? 0);
    setReports(reportRes.error ? 0 : reportRes.count ?? 0);
  }, [profile?.role]);

  useEffect(() => {
    void refresh();
    if (profile?.role !== 'admin') return;
    const channel = uniqueChannel('admin-pending-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apartments' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_reports' }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.role, refresh]);

  return { owners, listings, bookings, ids, reports };
}
