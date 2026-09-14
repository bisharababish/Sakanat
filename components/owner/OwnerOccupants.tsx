import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToday } from '@/src/hooks/useToday';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { bookingStatusLabel, bookingTone, formatStayRange, localizedTitle } from '@/src/lib/format';
import {
  floorLabel,
  listingPlaceLine,
  loadOwnerOccupancy,
  occupancyMoves,
  occupancyTotals,
  unitLabel,
  type OccupancyBuilding,
  type OccupancyMove,
} from '@/src/lib/listingPlace';
import { radius } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export function OwnerOccupants({ ownerId }: { ownerId: string }) {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const today = useToday();
  const [buildings, setBuildings] = useState<OccupancyBuilding[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBuildings(await loadOwnerOccupancy(ownerId, i18n.language, t('owner.untitledUnit')));
  }, [i18n.language, ownerId, t]);

  const { refreshing } = useLiveReload(
    load,
    ['apartments', 'bookings'],
    `owner-occupants:${ownerId}`,
  );

  const totals = occupancyTotals(buildings);
  const moves = occupancyMoves(buildings, today, t);
  const arriving = moves.filter((item) => item.kind === 'arrive');
  const leaving = moves.filter((item) => item.kind === 'leave');
  const moveLabel = (item: OccupancyMove) =>
    item.kind === 'arrive'
      ? item.days === 0
        ? t('owner.arrivesToday')
        : t('owner.arrivesIn', { count: item.days })
      : item.days === 0
        ? t('owner.leavesToday')
        : t('owner.leavesIn', { count: item.days });

  if (buildings.length === 0 && !refreshing) {
    return (
      <EmptyState
        title={t('owner.occupantsEmpty')}
        actionTitle={t('owner.addListing')}
        onAction={() => router.push('/(owner)/listing/new')}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('owner.occupantsIntro')}</Text>
      <View style={[styles.totals, row]}>
        <Stat label={t('owner.staying')} value={String(totals.people)} />
        <Stat label={t('owner.vacant')} value={String(totals.vacant)} />
        <Stat label={t('owner.waiting')} value={String(totals.pending)} />
        <Stat label={t('owner.buildings')} value={String(totals.buildings)} />
      </View>

      {arriving.length || leaving.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {arriving.length ? (
            <MoveBlock
              title={t('owner.arrivingSoon')}
              items={arriving}
              labelFor={moveLabel}
              onPress={(item) =>
                router.push({ pathname: '/(owner)/(tabs)/bookings', params: { focus: item.bookingId } })
              }
            />
          ) : null}
          {leaving.length ? (
            <MoveBlock
              title={t('owner.leavingSoon')}
              items={leaving}
              labelFor={moveLabel}
              onPress={(item) =>
                router.push({ pathname: '/(owner)/(tabs)/bookings', params: { focus: item.bookingId } })
              }
            />
          ) : null}
        </View>
      ) : null}

      {buildings.map((building) => {
        const open = openKey === building.key || buildings.length === 1;
        let lastFloor: number | null | undefined = undefined;
        return (
          <View
            key={building.key}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Pressable
              onPress={() => setOpenKey(open && buildings.length > 1 ? null : building.key)}
              style={[styles.head, row]}
              accessibilityRole="button"
            >
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="business-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.headCopy}>
                <Text style={[styles.building, rtlText, { color: colors.text }]} numberOfLines={1}>
                  {building.name}
                </Text>
                <Text style={[styles.meta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
                  {t('owner.buildingMeta', {
                    units: building.units.length,
                    people: building.people,
                    vacant: building.vacant,
                  })}
                </Text>
              </View>
              {building.pending > 0 ? (
                <StatusBadge label={t('owner.pendingShort', { count: building.pending })} tone="pending" />
              ) : null}
              {buildings.length > 1 ? (
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              ) : null}
            </Pressable>

            {open
              ? building.units.map((unit) => {
                  const floor = unit.apartment.floor;
                  const showFloor = floor !== lastFloor;
                  lastFloor = floor;
                  const place = listingPlaceLine(unit.apartment, t, { skipBuilding: true });
                  const title = localizedTitle(unit.apartment, i18n.language);
                  const confirmed = unit.stays.filter((item) => item.status === 'confirmed');
                  const pending = unit.stays.filter((item) => item.status === 'pending');
                  return (
                    <View key={unit.apartment.id}>
                      {showFloor ? (
                        <Text style={[styles.floor, rtlText, { color: colors.primary }]}>
                          {floorLabel(floor, t) || t('owner.floorUnknown')}
                        </Text>
                      ) : null}
                      <View style={[styles.unit, { borderTopColor: colors.border }]}>
                        <Pressable
                          onPress={() =>
                            router.push({ pathname: '/(owner)/listing/[id]', params: { id: unit.apartment.id } })
                          }
                          style={[styles.unitHead, row]}
                        >
                          <Text style={[styles.unitTitle, rtlText, { color: colors.text }]} numberOfLines={1}>
                            {unitLabel(unit.apartment.unit_number, t) || title}
                          </Text>
                          {place && unit.apartment.unit_number ? (
                            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
                              {title}
                            </Text>
                          ) : null}
                        </Pressable>
                        {confirmed.length === 0 && pending.length === 0 ? (
                          <Text style={[styles.emptyUnit, rtlText, { color: colors.textMuted }]}>
                            {t('owner.unitVacant')}
                          </Text>
                        ) : null}
                        {unit.stays.map((stay) => (
                          <Pressable
                            key={stay.bookingId}
                            onPress={() =>
                              router.push({
                                pathname: '/(owner)/(tabs)/bookings',
                                params: { focus: stay.bookingId },
                              })
                            }
                            style={[styles.person, row, { backgroundColor: colors.surfaceMuted }]}
                          >
                            {stay.avatarUrl ? (
                              <Image source={{ uri: stay.avatarUrl }} style={styles.avatar} contentFit="cover" />
                            ) : (
                              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                                <Ionicons name="person" size={14} color={colors.primary} />
                              </View>
                            )}
                            <View style={styles.personCopy}>
                              <Text style={[styles.personName, rtlText, { color: colors.text }]} numberOfLines={1}>
                                {stay.name || t('chat.unknownPerson')}
                              </Text>
                              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
                                {t('booking.people', { count: stay.occupants })}
                                {' · '}
                                {formatStayRange(stay.startDate, stay.months, i18n.language)}
                              </Text>
                              {stay.status === 'pending' ? (
                                <Text style={[styles.moveChip, rtlText, { color: colors.warning }]} numberOfLines={1}>
                                  {t('owner.notMovedIn')}
                                </Text>
                              ) : null}
                              {moves
                                .filter((item) => item.bookingId === stay.bookingId)
                                .map((item) => (
                                  <Text
                                    key={`${item.kind}-${item.bookingId}`}
                                    style={[styles.moveChip, rtlText, { color: colors.warning }]}
                                    numberOfLines={1}
                                  >
                                    {moveLabel(item)}
                                  </Text>
                                ))}
                            </View>
                            <StatusBadge
                              label={bookingStatusLabel(stay.status, t)}
                              tone={bookingTone(stay.status)}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })
              : null}
          </View>
        );
      })}
    </View>
  );
}

function MoveBlock({
  title,
  items,
  labelFor,
  onPress,
}: {
  title: string;
  items: OccupancyMove[];
  labelFor: (item: OccupancyMove) => string;
  onPress: (item: OccupancyMove) => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  return (
    <View style={styles.moveBlock}>
      <Text style={[styles.moveTitle, rtlText, { color: colors.primaryDark }]}>{title}</Text>
      {items.map((item) => (
        <Pressable
          key={`${item.kind}-${item.bookingId}`}
          onPress={() => onPress(item)}
          style={[styles.moveRow, row]}
          accessibilityRole="button"
        >
          <Ionicons
            name={item.kind === 'arrive' ? 'log-in-outline' : 'log-out-outline'}
            size={16}
            color={colors.warning}
          />
          <View style={styles.personCopy}>
            <Text style={[styles.personName, rtlText, { color: colors.text }]} numberOfLines={1}>
              {item.name || t('chat.unknownPerson')}
            </Text>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
              {[item.buildingName, item.place, labelFor(item)].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { rtlText } = useLayout();
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.primarySoft }]}>
      <Text style={[styles.statValue, rtlText, { color: colors.primaryDark }]}>{value}</Text>
      <Text style={[styles.statLabel, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  totals: { gap: 8, flexWrap: 'wrap' },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
    gap: 2,
  },
  statValue: { fontSize: 18, fontFamily: 'Cairo_800ExtraBold' },
  statLabel: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  head: { alignItems: 'center', gap: 10, padding: 10 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCopy: { flex: 1, minWidth: 0, gap: 2 },
  building: { fontSize: 15, fontFamily: 'Cairo_800ExtraBold' },
  meta: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  floor: {
    fontSize: 12,
    fontFamily: 'Cairo_700Bold',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  unit: { paddingHorizontal: 10, paddingBottom: 10, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  unitHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8 },
  unitTitle: { flex: 1, fontSize: 13, fontFamily: 'Cairo_700Bold' },
  emptyUnit: { fontSize: 12, fontFamily: 'Cairo_400Regular', paddingBottom: 4 },
  person: {
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  avatar: { width: 28, height: 28, borderRadius: 10 },
  personCopy: { flex: 1, minWidth: 0, gap: 1 },
  personName: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  moveBlock: { paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  moveTitle: { fontSize: 13, fontFamily: 'Cairo_800ExtraBold' },
  moveRow: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  moveChip: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
});
