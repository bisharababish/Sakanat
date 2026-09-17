import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SectionHead } from '@/components/profile/SectionHead';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { FilterPills } from '@/components/ui/FilterPills';
import { Select } from '@/components/ui/Select';
import { useLayout } from '@/src/hooks/useLayout';
import { alert } from '@/src/lib/notice';
import { supabase } from '@/src/lib/supabase';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { GenderPolicy, Profile } from '@/src/types/database';

const PRICE_OPTIONS = ['400', '600', '800', '1000', '1200', '1500', '2000', '2500', '3000'];
const LEASE_MONTHS = [1, 2, 3, 4, 6, 12];

type Props = {
  profile: Profile;
  onSaved: () => void | Promise<void>;
};

export function ProfileSearchPrefs({ profile, onSaved }: Props) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [budget, setBudget] = useState(profile.pref_budget_max != null ? String(Math.round(Number(profile.pref_budget_max))) : '');
  const [gender, setGender] = useState<GenderPolicy | 'any'>(profile.pref_gender_policy ?? 'any');
  const [moveIn, setMoveIn] = useState(profile.pref_move_in ?? '');
  const [occupants, setOccupants] = useState(profile.pref_occupants != null ? String(profile.pref_occupants) : '');
  const [lease, setLease] = useState(profile.pref_lease_months != null ? String(profile.pref_lease_months) : '');

  useEffect(() => {
    setBudget(profile.pref_budget_max != null ? String(Math.round(Number(profile.pref_budget_max))) : '');
    setGender(profile.pref_gender_policy ?? 'any');
    setMoveIn(profile.pref_move_in ?? '');
    setOccupants(profile.pref_occupants != null ? String(profile.pref_occupants) : '');
    setLease(profile.pref_lease_months != null ? String(profile.pref_lease_months) : '');
  }, [
    profile.id,
    profile.pref_budget_max,
    profile.pref_gender_policy,
    profile.pref_move_in,
    profile.pref_occupants,
    profile.pref_lease_months,
  ]);

  const persist = async (patch: Record<string, unknown>, revert: () => void) => {
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
      if (error) throw error;
      await onSaved();
    } catch (err) {
      revert();
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.settingsSaveFailed'));
    }
  };

  return (
    <Card compact>
      <View style={styles.dense}>
        <SectionHead compact icon="options-outline" title={t('profile.prefsTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.prefsIntro')}</Text>

        <Select
          dense
          label={t('profile.budgetMax')}
          value={budget}
          placeholder={t('common.select')}
          options={[
            { value: '', label: t('profile.prefAny') },
            ...PRICE_OPTIONS.map((value) => ({ value, label: `₪${value}` })),
          ]}
          onChange={(next) => {
            const prev = budget;
            setBudget(next);
            void persist({ pref_budget_max: next ? Number(next) : null }, () => setBudget(prev));
          }}
          clearable
        />

        <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.houseGender')}</Text>
        <FilterPills
          compact
          value={gender}
          onChange={(next) => {
            const prev = gender;
            setGender(next);
            void persist({ pref_gender_policy: next === 'any' ? 'any' : next }, () => setGender(prev));
          }}
          items={[
            { value: 'any', label: t('profile.prefAny') },
            { value: 'female', label: t('gender.female') },
            { value: 'male', label: t('gender.male') },
          ]}
        />

        <DateField compact kind="booking" label={t('profile.moveInPref')} value={moveIn} onChange={(next) => {
          const prev = moveIn;
          setMoveIn(next);
          void persist({ pref_move_in: next || null }, () => setMoveIn(prev));
        }} />

        <Select
          dense
          label={t('profile.roommateCount')}
          value={occupants}
          placeholder={t('common.select')}
          options={[
            { value: '', label: t('profile.prefAny') },
            { value: '1', label: t('booking.onePerson') },
            { value: '2', label: t('booking.people', { count: 2 }) },
            { value: '3', label: t('booking.people', { count: 3 }) },
            { value: '4', label: t('booking.people', { count: 4 }) },
          ]}
          onChange={(next) => {
            const prev = occupants;
            setOccupants(next);
            void persist({ pref_occupants: next ? Number(next) : null }, () => setOccupants(prev));
          }}
          clearable
        />

        <Select
          dense
          label={t('profile.leasePref')}
          value={lease}
          placeholder={t('common.select')}
          options={[
            { value: '', label: t('profile.prefAny') },
            ...LEASE_MONTHS.map((value) => ({
              value: String(value),
              label: `${value} ${value === 1 ? t('common.month') : t('common.months')}`,
            })),
          ]}
          onChange={(next) => {
            const prev = lease;
            setLease(next);
            void persist({ pref_lease_months: next ? Number(next) : null }, () => setLease(prev));
          }}
          clearable
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  dense: { gap: spacing.xs, maxWidth: '100%' },
  denseLabel: { fontWeight: '700', fontSize: 12, fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_400Regular' },
});
