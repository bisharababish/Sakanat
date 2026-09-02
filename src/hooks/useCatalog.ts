import { useCallback, useEffect, useState } from 'react';

import { subscribeCatalog } from '@/src/lib/catalog';
import { supabase } from '@/src/lib/supabase';
import type { City, University } from '@/src/types/database';

export function useCatalog() {
  const [cities, setCities] = useState<City[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeCatalog(() => setTick((value) => value + 1)), []);

  useEffect(() => {
    const channel = supabase
      .channel('catalog-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cities' }, () =>
        setTick((value) => value + 1),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'universities' }, () =>
        setTick((value) => value + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [cityRes, uniRes] = await Promise.all([
        supabase.from('cities').select('*').order('name_ar'),
        supabase.from('universities').select('*, cities(*)').order('name_ar'),
      ]);
      if (!mounted) return;
      setCities((cityRes.data as City[]) ?? []);
      setUniversities((uniRes.data as University[]) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return { cities, universities, loading, reload };
}
