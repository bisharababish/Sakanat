import { useEffect, useState } from 'react';

import { supabase } from '@/src/lib/supabase';
import type { City, University } from '@/src/types/database';

export function useCatalog() {
  const [cities, setCities] = useState<City[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return { cities, universities, loading };
}
