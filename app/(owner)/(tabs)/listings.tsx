import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { listingBadgeTone } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { colors, radius, spacing } from '@/src/theme/colors';
import type { Apartment, ListingStatus } from '@/src/types/database';

type Filter = 'all' | ListingStatus;

export default function OwnerListings() {
  const { t } = useTranslation();
  const { rtlText, isRtl, writingDirection, textAlign } = useLayout();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Apartment[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const chipAlign = { justifyContent: isRtl ? ('flex-end' as const) : ('flex-start' as const) };

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('apartments')
      .select('*, cities(*), universities(*)')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });
    setListings((data as Apartment[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(
    () => (filter === 'all' ? listings : listings.filter((item) => item.status === filter)),
    [filter, listings],
  );

  const removeListing = (id: string) => {
    alert(t('owner.deleteListing'), t('owner.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.deleteListing'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('apartments').delete().eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const hideListing = (id: string) => {
    alert(t('owner.hideListing'), t('owner.confirmHide'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('owner.hideListing'),
        onPress: async () => {
          const { error } = await supabase.from('apartments').update({ status: 'hidden' }).eq('id', id);
          if (error) alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  const unhideListing = async (id: string) => {
    const { error } = await supabase.from('apartments').update({ status: 'approved' }).eq('id', id);
    if (error) alert(t('common.error'), error.message);
    else void load();
  };

  const addListing = () => router.push('/(owner)/listing/new');

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, rtlText]}>{t('tabs.listings')}</Text>
        <Text style={[styles.count, rtlText]}>{t('owner.listingCount', { count: listings.length })}</Text>
      </View>

      {profile?.owner_status === 'pending' ? (
        <View style={styles.warnBox}>
          <View style={styles.warnIcon}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
          </View>
          <Text style={[styles.warn, { writingDirection, textAlign }]}>{t('auth.ownerPending')}</Text>
        </View>
      ) : null}
      {profile?.owner_status === 'rejected' ? (
        <View style={styles.warnBox}>
          <View style={styles.warnIcon}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          </View>
          <Text style={[styles.warn, { writingDirection, textAlign }]}>{t('admin.ownerSuspended')}</Text>
        </View>
      ) : null}

      <Button title={t('owner.addListing')} onPress={addListing} pill />

      <View style={[styles.chips, chipAlign]}>
        {(['all', 'pending', 'approved', 'hidden', 'rejected'] as Filter[]).map((value) => (
          <Chip
            key={value}
            label={value === 'all' ? t('common.all') : t(`status.${value}`)}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Ionicons name="home-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, rtlText]}>
            {listings.length === 0 ? t('owner.empty') : t('owner.emptyFiltered')}
          </Text>
          {listings.length === 0 ? <Button title={t('owner.addFirst')} onPress={addListing} pill /> : null}
        </View>
      ) : null}

      {visible.map((item) => (
        <View key={item.id} style={styles.block}>
          <ListingCard
            apartment={item}
            university={item.universities}
            distanceKm={item.campus_distance_km}
            badge={{ label: t(`status.${item.status}`), tone: listingBadgeTone(item.status) }}
            onPress={() => router.push({ pathname: '/(owner)/listing/[id]', params: { id: item.id } })}
          />
          <View style={[styles.actions, chipAlign]}>
            {item.status === 'approved' ? (
              <Pressable onPress={() => hideListing(item.id)} style={styles.action}>
                <Ionicons name="eye-off-outline" size={16} color={colors.primaryDark} />
                <Text style={[styles.actionText, { writingDirection }]}>{t('owner.hideListing')}</Text>
              </Pressable>
            ) : null}
            {item.status === 'hidden' ? (
              <Pressable onPress={() => void unhideListing(item.id)} style={styles.action}>
                <Ionicons name="eye-outline" size={16} color={colors.primaryDark} />
                <Text style={[styles.actionText, { writingDirection }]}>{t('owner.unhideListing')}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => removeListing(item.id)} style={[styles.action, styles.actionDanger]}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.actionDangerText, { writingDirection }]}>{t('owner.deleteListing')}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold', color: colors.text },
  count: { color: colors.textMuted, fontSize: 14, fontFamily: 'Cairo_400Regular' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warnIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warn: { flex: 1, color: colors.warning, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  block: { gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionDanger: { backgroundColor: colors.dangerSoft },
  actionText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  actionDangerText: { color: colors.danger, fontSize: 13, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  emptyBox: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Cairo_400Regular',
  },
});
