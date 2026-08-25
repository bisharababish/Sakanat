import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChromeBar } from '@/components/ui/ChromeBar';
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ChromeBar back />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return <ListingEditor apartment={apartment} />;
}
