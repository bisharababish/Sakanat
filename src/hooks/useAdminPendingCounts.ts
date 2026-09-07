import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/src/lib/auth';
import { supabase, uniqueChannel } from '@/src/lib/supabase';
import { hasIdDocs } from '@/src/lib/trust';
import type { Profile } from '@/src/types/database';

type AdminPendingCounts = {
  owners: number;
  listings: number;
  bookings: number;
  ids: number;
  reports: number;
  refresh: () => Promise<void>;
};

const EMPTY: AdminPendingCounts = {
  owners: 0,
  listings: 0,
  bookings: 0,
  ids: 0,
  reports: 0,
  refresh: async () => undefined,
};

const AdminPendingContext = createContext<AdminPendingCounts | null>(null);

async function countExact(
  run: () => PromiseLike<{ count: number | null; error: { message?: string } | null }>,
) {
  try {
    const { count, error } = await run();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export function AdminPendingProvider({ children }: { children: ReactNode }) {
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

    try {
      const [ownerCount, listingCount, bookingCount, idRows, reportCount] = await Promise.all([
        countExact(() =>
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'owner')
            .eq('owner_status', 'pending'),
        ),
        countExact(() =>
          supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ),
        countExact(() =>
          supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ),
        (async () => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, role, national_id_url, university_card_url, id_verify_status')
              .eq('id_verify_status', 'pending');
            if (error || !data) return 0;
            return ((data as Profile[]) ?? []).filter((item) => hasIdDocs(item)).length;
          } catch {
            return 0;
          }
        })(),
        countExact(() =>
          supabase
            .from('app_reports')
            .select('id', { count: 'exact', head: true })
            .in('status', ['open', 'reviewing']),
        ),
      ]);

      setOwners(ownerCount);
      setListings(listingCount);
      setBookings(bookingCount);
      setIds(idRows);
      setReports(reportCount);
    } catch {
      // Keep last known values if a refresh fails mid-flight.
    }
  }, [profile?.role]);

  useEffect(() => {
    void refresh();
    if (profile?.role !== 'admin') return;

    let channel: ReturnType<typeof uniqueChannel> | null = null;
    try {
      channel = uniqueChannel('admin-pending-counts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'apartments' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_reports' }, () => void refresh())
        .subscribe();
    } catch {
      channel = null;
    }

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => {
      if (channel) void supabase.removeChannel(channel);
      appSub.remove();
    };
  }, [profile?.role, refresh]);

  const value = useMemo(
    () => ({ owners, listings, bookings, ids, reports, refresh }),
    [owners, listings, bookings, ids, reports, refresh],
  );

  return createElement(AdminPendingContext.Provider, { value }, children);
}

export function useAdminPendingCounts() {
  return useContext(AdminPendingContext) ?? EMPTY;
}
