import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { ListingEditor } from '@/components/ListingEditor';
import { Button } from '@/components/ui/Button';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { useLayout } from '@/src/hooks/useLayout';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment } from '@/src/types/database';

export default function AdminEditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setMissing(true);
      return;
    }
    let alive = true;
    setLoading(true);
    void supabase
      .from('apartments')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data) {
          setApartment(data as Apartment);
          setMissing(false);
        } else {
          setApartment(null);
          setMissing(true);
        }
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ChromeBar back />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (missing || !apartment) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ChromeBar back />
        <View style={styles.center}>
          <Text style={[styles.miss, rtlText, { color: colors.textMuted }]}>{t('listing.editNotFound')}</Text>
          <Button title={t('common.back')} pill onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return <ListingEditor apartment={apartment} asAdmin />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  miss: { fontSize: 15, fontFamily: 'Cairo_600SemiBold', textAlign: 'center' },
});
