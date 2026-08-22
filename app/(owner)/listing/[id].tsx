import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ListingEditor } from '@/components/ListingEditor';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { Apartment } from '@/src/types/database';

export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [apartment, setApartment] = useState<Apartment | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from('apartments').select('*').eq('id', id).single().then(({ data }) => setApartment(data as Apartment));
  }, [id]);

  if (!apartment) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <ListingEditor apartment={apartment} />;
}
