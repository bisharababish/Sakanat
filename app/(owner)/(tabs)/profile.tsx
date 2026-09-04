import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OwnerSeenCard } from '@/components/profile/OwnerSeenCard';
import { ProfileAccountFields } from '@/components/profile/ProfileAccountFields';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { ProfileSecurity } from '@/components/profile/ProfileSecurity';
import { ProfileSegments } from '@/components/profile/ProfileSegments';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { ageLabel, localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { regionPrefix, sameMobile, splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { pickProfilePhoto } from '@/src/lib/pickImage';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import type { PersonGender, Profile } from '@/src/types/database';

type ProfileTab = 'account' | 'security';

export default function OwnerProfile() {
  const { t, i18n } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const { cities } = useCatalog();
  const today = useToday();
  const [tab, setTab] = useState<ProfileTab>('account');
  const [fullNameEn, setFullNameEn] = useState('');
  const [fullNameAr, setFullNameAr] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [waRegion, setWaRegion] = useState<PhoneRegion>('ps');
  const [waLocal, setWaLocal] = useState('');
  const [waLinked, setWaLinked] = useState(true);
  const [gender, setGender] = useState<PersonGender | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [cityId, setCityId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const hydratedId = useRef<string | null>(null);

  const applyForm = useCallback((next: Profile) => {
    const names = namesFromProfile(next.full_name, next.full_name_en);
    setFullNameEn(names.en);
    setFullNameAr(names.ar);
    const phoneParts = splitPhone(next.phone);
    setPhoneRegion(phoneParts.region);
    setPhoneLocal(phoneParts.local);
    const waParts = splitPhone(next.whatsapp);
    const sameNumber = !waParts.local || (waParts.region === phoneParts.region && waParts.local === phoneParts.local);
    setWaLinked(sameNumber);
    setWaRegion(sameNumber ? phoneParts.region : waParts.region);
    setWaLocal(sameNumber ? phoneParts.local : waParts.local);
    setGender(next.gender ?? '');
    setBirthDate(next.date_of_birth ? next.date_of_birth.slice(0, 10) : '');
    setCityId(next.city_id ?? '');
    setAvatarUrl(next.avatar_url ?? null);
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (hydratedId.current === profile.id) return;
    hydratedId.current = profile.id;
    applyForm(profile);
  }, [profile, applyForm]);

  const loadListings = useCallback(async () => {
    if (!profile?.id) return;
    const { count } = await supabase
      .from('apartments')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', profile.id);
    setListingCount(count ?? 0);
  }, [profile?.id]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadListings(), refreshProfile()]);
  }, [loadListings, refreshProfile]);

  const reloadPull = useCallback(async () => {
    const [, next] = await Promise.all([loadListings(), refreshProfile()]);
    if (next) applyForm(next);
  }, [loadListings, refreshProfile, applyForm]);

  const { refreshing, refresh } = useLiveReload(reloadAll, ['apartments', 'profiles'], `owner-profile:${profile?.id ?? ''}`, reloadPull);

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const cityName = useMemo(
    () => localizedName(cities.find((item) => item.id === cityId), i18n.language),
    [cities, cityId, i18n.language],
  );

  const applyPhone = (region: PhoneRegion, local: string) => {
    setPhoneRegion(region);
    setPhoneLocal(local);
    if (waLinked) {
      setWaRegion(region);
      setWaLocal(local);
    } else if (sameMobile(region, local, waRegion, waLocal)) {
      setWaLinked(true);
    }
  };
  const applyWhatsapp = (region: PhoneRegion, local: string) => {
    setWaRegion(region);
    setWaLocal(local);
    if (waLinked) {
      setPhoneRegion(region);
      setPhoneLocal(local);
    } else if (sameMobile(phoneRegion, phoneLocal, region, local)) {
      setWaLinked(true);
    }
  };

  const statusLabel =
    profile?.owner_status === 'approved'
      ? t('admin.ownerActive')
      : profile?.owner_status === 'rejected'
        ? t('admin.ownerSuspended')
        : t('admin.ownerWaiting');

  const banner =
    profile?.owner_status !== 'approved'
      ? { icon: 'hourglass' as const, text: statusLabel, onPress: () => setTab('account') }
      : listingCount > 0
        ? {
            icon: 'home' as const,
            text: t('profile.listingCount', { count: listingCount }),
            onPress: () => router.push('/(owner)/(tabs)/listings'),
          }
        : {
            icon: 'home' as const,
            text: t('tabs.listings'),
            onPress: () => router.push('/(owner)/(tabs)/listings'),
          };

  const changePhoto = async () => {
    if (!profile) return;
    const uri = await pickProfilePhoto();
    if (!uri) return;
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(profile.id, uri);
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
      if (error) throw error;
      setAvatarUrl(url);
      await refreshProfile();
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile || !fullNameEn.trim() || !fullNameAr.trim() || !phoneLocal.trim() || !waLocal.trim() || !gender || !cityId || !birthDate || !avatarUrl) {
      alert(t('common.error'), t('profile.completeRequiredRenter'));
      return;
    }
    if (!isValidEnglishName(fullNameEn)) {
      alert(t('common.error'), t('auth.invalidNameEn'));
      return;
    }
    if (!isValidArabicName(fullNameAr)) {
      alert(t('common.error'), t('auth.invalidNameAr'));
      return;
    }
    const cleanPhone = toE164(phoneRegion, phoneLocal);
    if (!cleanPhone) {
      alert(t('common.error'), t('phone.invalid'));
      return;
    }
    const cleanWhatsapp = toE164(waRegion, waLocal);
    if (!cleanWhatsapp) {
      alert(t('common.error'), t('phone.invalid'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName(fullNameAr),
          phone: cleanPhone,
          whatsapp: cleanWhatsapp,
          gender,
          date_of_birth: birthDate,
          city_id: cityId,
        })
        .eq('id', profile.id);
      if (error) throw error;
      const { error: nameError } = await supabase.auth.updateUser({
        data: { full_name_en: cleanName(fullNameEn) },
      });
      if (nameError) throw nameError;
      await refreshProfile();
      alert(t('common.done'), t('profile.saved'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const incomplete = Boolean(
    !fullNameEn.trim() ||
      !fullNameAr.trim() ||
      !gender ||
      !cityId ||
      !birthDate ||
      !phoneLocal.trim() ||
      !waLocal.trim() ||
      !avatarUrl,
  );
  const progressItems = [
    { label: t('profile.photo'), done: Boolean(avatarUrl) },
    { label: t('common.nameEn'), done: Boolean(fullNameEn.trim()) },
    { label: t('common.nameAr'), done: Boolean(fullNameAr.trim()) },
    { label: t('profile.gender'), done: Boolean(gender) },
    { label: t('auth.homeCity'), done: Boolean(cityId) },
    { label: t('profile.birthDate'), done: Boolean(birthDate) },
    { label: t('common.phone'), done: Boolean(phoneLocal.trim()) },
    { label: t('profile.whatsapp'), done: Boolean(waLocal.trim()) },
  ];

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      footer={
        tab === 'account' ? (
          <Button title={t('profile.saveProfile')} onPress={saveProfile} loading={saving} pill />
        ) : null
      }
    >
      <ProfileHero
        name={displayName({ full_name: fullNameAr, full_name_en: fullNameEn }, i18n.language) || t('profile.title')}
        avatarUrl={avatarUrl}
        uploading={uploading}
        onChangePhoto={() => void changePhoto()}
        metas={[
          { icon: 'shield-checkmark', text: statusLabel },
          ...(ageLabel(birthDate, t, today)
            ? [{ icon: 'hourglass-outline' as const, text: ageLabel(birthDate, t, today) }]
            : []),
          ...(cityName ? [{ icon: 'location' as const, text: cityName }] : []),
        ]}
        chip={t('roles.owner')}
        email={profile?.email}
      />
      <ProfileBanner icon={banner.icon} text={banner.text} onPress={banner.onPress} />
      <ProfileSegments
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'account', icon: 'person', label: t('profile.tabAccount'), dot: incomplete },
          { key: 'security', icon: 'lock-closed', label: t('profile.tabSecurity') },
        ]}
      />

      {tab === 'account' ? (
        <>
          <OwnerSeenCard
            title={t('profile.studentSees')}
            name={fullNameAr.trim() || t('profile.title')}
            avatarUrl={avatarUrl}
            lines={[
              ...(gender ? [{ icon: 'person-outline' as const, text: t(`profile.${gender}`) }] : []),
              ...(ageLabel(birthDate, t, today)
                ? [{ icon: 'hourglass-outline' as const, text: ageLabel(birthDate, t, today) }]
                : []),
              ...(cityName ? [{ icon: 'location-outline' as const, text: cityName }] : []),
              ...(phoneLocal.trim()
                ? [{ icon: 'call-outline' as const, text: `${regionPrefix(phoneRegion)} ${phoneLocal}` }]
                : []),
            ].filter((item) => item.text)}
          />
          <ProfileProgress items={progressItems} />
          <ProfileAccountFields
            email={profile?.email ?? ''}
            fullNameEn={fullNameEn}
            onFullNameEn={setFullNameEn}
            fullNameAr={fullNameAr}
            onFullNameAr={setFullNameAr}
            gender={gender}
            onGender={setGender}
            cityId={cityId}
            onCityId={setCityId}
            cityOptions={cityOptions}
            birthDate={birthDate}
            onBirthDate={setBirthDate}
            phoneRegion={phoneRegion}
            phoneLocal={phoneLocal}
            onPhone={applyPhone}
            waRegion={waRegion}
            waLocal={waLocal}
            onWhatsapp={applyWhatsapp}
            waLinked={waLinked}
            onWaLinked={setWaLinked}
          />
        </>
      ) : null}

      {tab === 'security' ? <ProfileSecurity /> : null}
    </Screen>
  );
}
