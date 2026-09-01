import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { ApartmentView } from '@/components/ApartmentView';
import { useCatalog } from '@/src/hooks/useCatalog';
import { listingDistanceKm } from '@/src/lib/distance';
import { supabase } from '@/src/lib/supabase';
import type { Apartment } from '@/src/types/database';

export default function OwnerListingPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { universities } = useCatalog();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email, whatsapp)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setApartment(data as Apartment);
        else setMissing(true);
      });
  }, [id]);

  const university = useMemo(
    () => universities.find((item) => item.id === apartment?.nearest_university_id) ?? apartment?.universities,
    [apartment, universities],
  );

  return (
    <ApartmentView
      apartment={apartment}
      missing={missing}
      university={university}
      distance={apartment ? listingDistanceKm(apartment, university) : null}
      preview
    />
  );
}
