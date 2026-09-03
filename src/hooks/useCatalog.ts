import { useCallback, useEffect, useState } from 'react';

import { subscribeCatalog, watchCatalogLive } from '@/src/lib/catalog';
import { supabase } from '@/src/lib/supabase';
import type { City, University } from '@/src/types/database';

export function useCatalog() {
  const [cities, setCities] = useState<City[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeCatalog(() => setTick((value) => value + 1)), []);
  useEffect(() => watchCatalogLive(), []);

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
