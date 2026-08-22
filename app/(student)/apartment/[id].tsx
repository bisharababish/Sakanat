import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { openConversation } from '@/src/lib/chat';
import { formatKm, listingDistanceKm, mapsUrl } from '@/src/lib/distance';
import { formatIls, localizedDescription, localizedName, localizedTitle } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Apartment } from '@/src/types/database';

export default function ApartmentDetails() {
  const { id, universityId } = useLocalSearchParams<{ id: string; universityId?: string }>();
  const { t, i18n } = useTranslation();
  const { textAlign, row, lang } = useLayout();
  const { profile } = useAuth();
  const { universities } = useCatalog();
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('apartments')
      .select('*, cities(*), universities(*), profiles!owner_id(id, full_name, phone, email)')
      .eq('id', id)
      .single()
      .then(({ data }) => setApartment(data as Apartment));
  }, [id]);

  const university = useMemo(
    () => universities.find((item) => item.id === (universityId || apartment?.nearest_university_id)) ?? apartment?.universities,
    [apartment, universities, universityId],
  );
  const distance = apartment ? listingDistanceKm(apartment, university) : null;

  if (!apartment) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const startChat = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const conversationId = await openConversation(apartment, profile.id);
      router.push({ pathname: '/(student)/conversation/[id]', params: { id: conversationId } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {apartment.photos[0] ? (
          <Image source={{ uri: apartment.photos[0] }} style={styles.cover} contentFit="cover" />
        ) : null}
        <Text style={[styles.title, { textAlign }]}>{localizedTitle(apartment, i18n.language)}</Text>
        <Text style={[styles.price, { textAlign }]}>
          {formatIls(apartment.price_month, lang)} / {t('common.perMonth')}
        </Text>
        <Text style={[styles.muted, { textAlign }]}>
          {localizedName(apartment.cities, i18n.language)} · {t('listing.roomsBaths', { rooms: apartment.rooms, baths: apartment.bathrooms })}
        </Text>
        <StatusBadge label={t(`gender.${apartment.gender_policy}`)} tone="info" />
        <Text style={[styles.body, { textAlign }]}>{localizedDescription(apartment, i18n.language)}</Text>
        <Text style={[styles.section, { textAlign }]}>{t('listing.distance')}</Text>
        <Text style={[styles.body, { textAlign }]}>
          {university ? localizedName(university, i18n.language) : ''}
          {distance != null ? `\n${formatKm(distance, lang)}` : ''}
        </Text>
        <Button
          title={t('common.openMaps')}
          variant="ghost"
          onPress={() => Linking.openURL(mapsUrl(apartment.lat, apartment.lng, localizedTitle(apartment, i18n.language)))}
        />
        <Text style={[styles.section, { textAlign }]}>{t('listing.amenities')}</Text>
        <View style={[styles.wrap, row]}>
          {apartment.amenities.map((item) => (
            <View key={item} style={styles.amenity}>
              <Text style={styles.amenityText}>{t(`amenities.${item}`)}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.section, { textAlign }]}>{t('listing.owner')}</Text>
        <Text style={[styles.body, { textAlign }]}>{apartment.profiles?.full_name}</Text>
        <Button title={t('listing.book')} onPress={() => router.push({ pathname: '/(student)/book/[id]', params: { id: apartment.id } })} />
        <Button title={t('listing.chat')} variant="secondary" onPress={startChat} loading={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 },
  cover: { width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  price: { fontSize: 20, fontWeight: '800', color: colors.primary },
  muted: { color: colors.textMuted },
  body: { fontSize: 16, color: colors.text, lineHeight: 24 },
  section: { marginTop: 8, fontWeight: '800', color: colors.text, fontSize: 16 },
  wrap: { flexWrap: 'wrap', gap: 8 },
  amenity: { backgroundColor: colors.primarySoft, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  amenityText: { color: colors.primaryDark, fontWeight: '700' },
});
