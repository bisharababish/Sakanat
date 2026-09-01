import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingEditor } from '@/components/ListingEditor';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment } from '@/src/types/database';

export default function AdminEditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [apartment, setApartment] = useState<Apartment | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('apartments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => setApartment(data as Apartment));
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

  return <ListingEditor apartment={apartment} asAdmin />;
}
