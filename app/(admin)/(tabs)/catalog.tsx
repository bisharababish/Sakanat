import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { notifyCatalogChanged, parseCoord, parseDomains, slugify } from '@/src/lib/catalog';
import { localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { CATALOG_PAGE_SIZE } from '@/src/lib/page';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';
import type { City, University } from '@/src/types/database';

type Pane = 'cities' | 'universities';

const emptyCity = { nameAr: '', nameEn: '', lat: '', lng: '' };
const emptyUni = { nameAr: '', nameEn: '', cityId: '', lat: '', lng: '', domains: '' };

async function uniqueSlug(table: 'cities' | 'universities', base: string, exceptId?: string) {
  const root = slugify(base) || `item-${Date.now()}`;
  let slug = root;
  for (let n = 2; n < 50; n += 1) {
    let query = supabase.from(table).select('id').eq('slug', slug);
    if (exceptId) query = query.neq('id', exceptId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    slug = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

export default function AdminCatalog() {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [pane, setPane] = useState<Pane>('cities');
  const [cities, setCities] = useState<City[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [cityForm, setCityForm] = useState(emptyCity);
  const [uniForm, setUniForm] = useState(emptyUni);
  const [cityId, setCityId] = useState<string | null>(null);
  const [uniId, setUniId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const [cityRes, uniRes] = await Promise.all([
      supabase.from('cities').select('*').order('name_ar'),
      supabase.from('universities').select('*, cities(*)').order('name_ar'),
    ]);
    setCities((cityRes.data as City[]) ?? []);
    setUniversities((uniRes.data as University[]) ?? []);
  }, []);

  const { refreshing, refresh } = useLiveReload(load, ['cities', 'universities'], 'admin-catalog');

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const needle = query.trim().toLowerCase();
  const visibleCities = useMemo(
    () =>
      cities.filter((city) => {
        if (!needle) return true;
        return [city.name_ar, city.name_en, city.slug].join(' ').toLowerCase().includes(needle);
      }),
    [cities, needle],
  );
  const visibleUniversities = useMemo(
    () =>
      universities.filter((item) => {
        if (!needle) return true;
        return [item.name_ar, item.name_en, item.slug, localizedName(item.cities, i18n.language), ...(item.email_domains ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      }),
    [universities, needle, i18n.language],
  );
  const pagedCities = usePaged(visibleCities, CATALOG_PAGE_SIZE, `cities:${query}`);
  const pagedUnis = usePaged(visibleUniversities, CATALOG_PAGE_SIZE, `unis:${query}`);

  const resetCity = () => {
    setCityId(null);
    setCityForm(emptyCity);
  };

  const resetUni = () => {
    setUniId(null);
    setUniForm(emptyUni);
  };

  const editCity = (city: City) => {
    setCityId(city.id);
    setCityForm({
      nameAr: city.name_ar,
      nameEn: city.name_en,
      lat: String(city.lat),
      lng: String(city.lng),
    });
  };

  const editUni = (item: University) => {
    setUniId(item.id);
    setUniForm({
      nameAr: item.name_ar,
      nameEn: item.name_en,
      cityId: item.city_id,
      lat: String(item.lat),
      lng: String(item.lng),
      domains: (item.email_domains ?? []).join(', '),
    });
  };

  const pickUniCity = (next: string) => {
    const city = cities.find((item) => item.id === next);
    setUniForm((form) => ({
      ...form,
      cityId: next,
      lat: form.lat || (city ? String(city.lat) : ''),
      lng: form.lng || (city ? String(city.lng) : ''),
    }));
  };

  const saveCity = async () => {
    const lat = parseCoord(cityForm.lat);
    const lng = parseCoord(cityForm.lng);
    if (!cityForm.nameAr.trim() || !cityForm.nameEn.trim() || lat == null || lng == null) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    setSaving(true);
    try {
      const slug = await uniqueSlug('cities', cityForm.nameEn, cityId ?? undefined);
      const row = {
        slug,
        name_ar: cityForm.nameAr.trim(),
        name_en: cityForm.nameEn.trim(),
        lat,
        lng,
      };
      const query = cityId
        ? supabase.from('cities').update(row).eq('id', cityId)
        : supabase.from('cities').insert(row);
      const { error } = await query;
      if (error) throw error;
      resetCity();
      notifyCatalogChanged();
      await load();
      alert(t('common.done'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const saveUni = async () => {
    const lat = parseCoord(uniForm.lat);
    const lng = parseCoord(uniForm.lng);
    if (!uniForm.nameAr.trim() || !uniForm.nameEn.trim() || !uniForm.cityId || lat == null || lng == null) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    setSaving(true);
    try {
      const slug = await uniqueSlug('universities', uniForm.nameEn, uniId ?? undefined);
      const row = {
        slug,
        name_ar: uniForm.nameAr.trim(),
        name_en: uniForm.nameEn.trim(),
        city_id: uniForm.cityId,
        lat,
        lng,
        email_domains: parseDomains(uniForm.domains),
      };
      const query = uniId
        ? supabase.from('universities').update(row).eq('id', uniId)
        : supabase.from('universities').insert(row);
      const { error } = await query;
      if (error) throw error;
      resetUni();
      notifyCatalogChanged();
      await load();
      alert(t('common.done'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const removeCity = (city: City) => {
    alert(t('admin.deleteCity'), t('admin.confirmDeleteCity'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const [unis, homes, people] = await Promise.all([
            supabase.from('universities').select('id', { count: 'exact', head: true }).eq('city_id', city.id),
            supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('city_id', city.id),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('city_id', city.id),
          ]);
          if ((unis.count ?? 0) + (homes.count ?? 0) + (people.count ?? 0) > 0) {
            alert(t('common.error'), t('admin.cannotDeleteCity'));
            return;
          }
          const { error } = await supabase.from('cities').delete().eq('id', city.id);
          if (error) {
            alert(t('common.error'), error.message);
            return;
          }
          if (cityId === city.id) resetCity();
          notifyCatalogChanged();
          await load();
        },
      },
    ]);
  };

  const removeUni = (item: University) => {
    alert(t('admin.deleteUniversity'), t('admin.confirmDeleteUniversity'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          const [homes, people] = await Promise.all([
            supabase.from('apartments').select('id', { count: 'exact', head: true }).eq('nearest_university_id', item.id),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('university_id', item.id),
          ]);
          if ((homes.count ?? 0) + (people.count ?? 0) > 0) {
            alert(t('common.error'), t('admin.cannotDeleteUniversity'));
            return;
          }
          const { error } = await supabase.from('universities').delete().eq('id', item.id);
          if (error) {
            alert(t('common.error'), error.message);
            return;
          }
          if (uniId === item.id) resetUni();
          notifyCatalogChanged();
          await load();
        },
      },
    ]);
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.catalog')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.catalogTitle')}</Text>
      <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.catalogHint')}</Text>
      <FilterPills
        value={pane}
        onChange={setPane}
        items={[
          { value: 'cities', label: t('admin.cities'), count: visibleCities.length },
          { value: 'universities', label: t('admin.universities'), count: visibleUniversities.length },
        ]}
      />
      <Input label={t('admin.searchCatalog')} value={query} onChangeText={setQuery} />

      {pane === 'cities' ? (
        <>
          <Card>
            <SectionHead icon="location-outline" title={cityId ? t('admin.editCity') : t('admin.addCity')} />
            <Input label={t('admin.nameAr')} value={cityForm.nameAr} onChangeText={(nameAr) => setCityForm((form) => ({ ...form, nameAr }))} />
            <Input label={t('admin.nameEn')} value={cityForm.nameEn} onChangeText={(nameEn) => setCityForm((form) => ({ ...form, nameEn }))} ltr />
            <Input label={t('admin.lat')} value={cityForm.lat} onChangeText={(lat) => setCityForm((form) => ({ ...form, lat }))} keyboardType="decimal-pad" ltr hint={t('admin.mapPinHint')} />
            <Input label={t('admin.lng')} value={cityForm.lng} onChangeText={(lng) => setCityForm((form) => ({ ...form, lng }))} keyboardType="decimal-pad" ltr />
            <Button title={t('common.save')} onPress={() => void saveCity()} loading={saving} pill />
            {cityId ? <Button title={t('admin.newInstead')} variant="ghost" onPress={resetCity} pill /> : null}
          </Card>
          {visibleCities.length === 0 ? <EmptyState title={t('admin.noCities')} /> : null}
          {pagedCities.slice.map((city) => (
            <Card key={city.id}>
              <Text style={[styles.name, rtlText, { color: colors.text }]}>{localizedName(city, i18n.language)}</Text>
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{city.name_en}</Text>
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
                {city.lat}, {city.lng}
              </Text>
              <Button title={t('admin.editCity')} variant="secondary" onPress={() => editCity(city)} />
              <Button title={t('admin.deleteCity')} variant="danger" onPress={() => removeCity(city)} />
            </Card>
          ))}
          <Pager
            page={pagedCities.page}
            pages={pagedCities.pages}
            from={pagedCities.from}
            to={pagedCities.to}
            total={pagedCities.total}
            pageSize={pagedCities.pageSize}
            onPage={pagedCities.setPage}
          />
        </>
      ) : (
        <>
          <Card>
            <SectionHead icon="school-outline" title={uniId ? t('admin.editUniversity') : t('admin.addUniversity')} />
            <Input label={t('admin.nameAr')} value={uniForm.nameAr} onChangeText={(nameAr) => setUniForm((form) => ({ ...form, nameAr }))} />
            <Input label={t('admin.nameEn')} value={uniForm.nameEn} onChangeText={(nameEn) => setUniForm((form) => ({ ...form, nameEn }))} ltr />
            <Select
              label={t('common.city')}
              value={uniForm.cityId}
              placeholder={t('common.select')}
              options={cityOptions}
              onChange={pickUniCity}
            />
            <Input label={t('admin.lat')} value={uniForm.lat} onChangeText={(lat) => setUniForm((form) => ({ ...form, lat }))} keyboardType="decimal-pad" ltr hint={t('admin.mapPinHint')} />
            <Input label={t('admin.lng')} value={uniForm.lng} onChangeText={(lng) => setUniForm((form) => ({ ...form, lng }))} keyboardType="decimal-pad" ltr />
            <Input
              label={t('admin.emailDomains')}
              value={uniForm.domains}
              onChangeText={(domains) => setUniForm((form) => ({ ...form, domains }))}
              autoCapitalize="none"
              ltr
              hint={t('admin.emailDomainsHint')}
            />
            <Button title={t('common.save')} onPress={() => void saveUni()} loading={saving} pill />
            {uniId ? <Button title={t('admin.newInstead')} variant="ghost" onPress={resetUni} pill /> : null}
          </Card>
          {visibleUniversities.length === 0 ? <EmptyState title={t('admin.noUniversities')} /> : null}
          {pagedUnis.slice.map((item) => (
            <Card key={item.id}>
              <Text style={[styles.name, rtlText, { color: colors.text }]}>{localizedName(item, i18n.language)}</Text>
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{item.name_en}</Text>
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{localizedName(item.cities, i18n.language)}</Text>
              {(item.email_domains ?? []).length ? (
                <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{item.email_domains.join(', ')}</Text>
              ) : null}
              <Button title={t('admin.editUniversity')} variant="secondary" onPress={() => editUni(item)} />
              <Button title={t('admin.deleteUniversity')} variant="danger" onPress={() => removeUni(item)} />
            </Card>
          ))}
          <Pager
            page={pagedUnis.page}
            pages={pagedUnis.pages}
            from={pagedUnis.from}
            to={pagedUnis.to}
            total={pagedUnis.total}
            pageSize={pagedUnis.pageSize}
            onPage={pagedUnis.setPage}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 14, fontFamily: 'Cairo_400Regular', lineHeight: 22, marginTop: -8 },
  name: { fontSize: 17, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  meta: { fontFamily: 'Cairo_400Regular' },
});
