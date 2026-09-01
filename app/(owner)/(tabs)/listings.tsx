import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Screen } from '@/components/ui/Screen';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { listingBadgeTone } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, ListingStatus } from '@/src/types/database';

type Filter = 'all' | ListingStatus;

export default function OwnerListings() {
  const { t } = useTranslation();
  const { rtlText, writingDirection, textAlign, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Apartment[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

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

  const counts = useMemo(() => {
    const next: Record<Filter, number> = {
      all: listings.length,
      pending: 0,
      approved: 0,
      hidden: 0,
      rejected: 0,
    };
    for (const item of listings) next[item.status] += 1;
    return next;
  }, [listings]);

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
  const filters: Filter[] = ['all', 'pending', 'approved', 'hidden', 'rejected'];

  return (
    <Screen>
      <View style={[styles.top, row]}>
        <View style={styles.topCopy}>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('tabs.listings')}</Text>
          <Text style={[styles.count, rtlText, { color: colors.textMuted }]}>
            {t('owner.listingCount', { count: listings.length })}
          </Text>
        </View>
      </View>

      {profile?.owner_status === 'pending' ? (
        <View style={[styles.warnBox, { backgroundColor: colors.warningSoft }]}>
          <View style={[styles.warnIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
          </View>
          <Text style={[styles.warn, { writingDirection, textAlign, color: colors.warning }]}>{t('auth.ownerPending')}</Text>
        </View>
      ) : null}
      {profile?.owner_status === 'rejected' ? (
        <View style={[styles.warnBox, { backgroundColor: colors.warningSoft }]}>
          <View style={[styles.warnIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          </View>
          <Text style={[styles.warn, { writingDirection, textAlign, color: colors.warning }]}>{t('admin.ownerSuspended')}</Text>
        </View>
      ) : null}

      <Button title={t('owner.addListing')} onPress={addListing} pill />

      <FilterPills
        value={filter}
        onChange={setFilter}
        items={filters.map((value) => ({
          value,
          label: value === 'all' ? t('common.all') : t(`status.${value}`),
          count: counts[value],
        }))}
      />

      {visible.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="home-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, rtlText, { color: colors.textMuted }]}>
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
          <View style={[styles.actions, row]}>
            {item.status === 'approved' ? (
              <Pressable
                onPress={() => hideListing(item.id)}
                style={[styles.action, { backgroundColor: colors.accentSoft }]}
              >
                <Ionicons name="eye-off-outline" size={16} color={colors.primaryDark} />
                <Text style={[styles.actionText, { writingDirection, color: colors.primaryDark }]}>
                  {t('owner.hideListing')}
                </Text>
              </Pressable>
            ) : null}
            {item.status === 'hidden' ? (
              <Pressable
                onPress={() => void unhideListing(item.id)}
                style={[styles.action, { backgroundColor: colors.accentSoft }]}
              >
                <Ionicons name="eye-outline" size={16} color={colors.primaryDark} />
                <Text style={[styles.actionText, { writingDirection, color: colors.primaryDark }]}>
                  {t('owner.unhideListing')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => removeListing(item.id)}
              style={[styles.action, { backgroundColor: colors.dangerSoft }]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.actionDangerText, { writingDirection, color: colors.danger }]}>
                {t('owner.deleteListing')}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  topCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  count: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  warnIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warn: { flex: 1, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  block: { gap: 10 },
  actions: { flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: { fontSize: 13, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  actionDangerText: { fontSize: 13, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: 24,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Cairo_400Regular',
  },
});
