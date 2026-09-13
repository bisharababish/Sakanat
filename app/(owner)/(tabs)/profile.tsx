import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OfflineBanner } from '@/components/OfflineBanner';
import { OwnerSeenCard } from '@/components/profile/OwnerSeenCard';
import { ProfileAccountFields } from '@/components/profile/ProfileAccountFields';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { ProfileSafetyFields } from '@/components/profile/ProfileSafetyFields';
import { ProfileSecurity } from '@/components/profile/ProfileSecurity';
import { ProfileSettingsFields } from '@/components/profile/ProfileSettingsFields';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useHubTabBack } from '@/src/hooks/useHubTabBack';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { ageLabel, localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { regionPrefix, sameMobile, splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { pickIdCardPhoto, pickProfilePhoto } from '@/src/lib/pickImage';
import {
  accountVerification,
  fetchPublicIp,
  isValidBio,
  isValidEmergencyName,
  isValidNationalId,
  isValidNationalIdExpiry,
  nationalIdExpiryState,
  sanitizeNationalId,
} from '@/src/lib/trust';
import { supabase } from '@/src/lib/supabase';
import { idDocUrl, uploadIdDoc, uploadProfilePhoto } from '@/src/lib/upload';
import { useColors } from '@/src/theme/ThemeProvider';
import type { PersonGender, Profile } from '@/src/types/database';

type ProfileTab = 'menu' | 'account' | 'trust' | 'settings' | 'security';

type FormSnap = {
  fullNameEn: string;
  fullNameAr: string;
  phoneRegion: PhoneRegion;
  phoneLocal: string;
  waLinked: boolean;
  waRegion: PhoneRegion;
  waLocal: string;
  gender: PersonGender | '';
  birthDate: string;
  cityId: string;
  avatarUrl: string | null;
  bio: string;
  spokenLanguages: string[];
  nationalId: string;
  nationalExpiresAt: string;
  idDocsConsent: boolean;
  nationalIdUrl: string | null;
  emergencyName: string;
  emergencyRegion: PhoneRegion;
  emergencyLocal: string;
};

function snapsEqual(a: FormSnap | null, b: FormSnap | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.fullNameEn === b.fullNameEn &&
    a.fullNameAr === b.fullNameAr &&
    a.phoneRegion === b.phoneRegion &&
    a.phoneLocal === b.phoneLocal &&
    a.waLinked === b.waLinked &&
    a.waRegion === b.waRegion &&
    a.waLocal === b.waLocal &&
    a.gender === b.gender &&
    a.birthDate === b.birthDate &&
    a.cityId === b.cityId &&
    a.avatarUrl === b.avatarUrl &&
    a.bio === b.bio &&
    a.spokenLanguages.join(',') === b.spokenLanguages.join(',') &&
    a.nationalId === b.nationalId &&
    a.nationalExpiresAt === b.nationalExpiresAt &&
    a.idDocsConsent === b.idDocsConsent &&
    a.nationalIdUrl === b.nationalIdUrl &&
    a.emergencyName === b.emergencyName &&
    a.emergencyRegion === b.emergencyRegion &&
    a.emergencyLocal === b.emergencyLocal
  );
}

function snapFromProfile(next: Profile): FormSnap {
  const names = namesFromProfile(next.full_name, next.full_name_en);
  const phoneParts = splitPhone(next.phone);
  const waParts = splitPhone(next.whatsapp);
  const sameNumber = !waParts.local || (waParts.region === phoneParts.region && waParts.local === phoneParts.local);
  const emergencyParts = splitPhone(next.emergency_phone);
  return {
    fullNameEn: names.en,
    fullNameAr: names.ar,
    phoneRegion: phoneParts.region,
    phoneLocal: phoneParts.local,
    waLinked: sameNumber,
    waRegion: sameNumber ? phoneParts.region : waParts.region,
    waLocal: sameNumber ? phoneParts.local : waParts.local,
    gender: next.gender ?? '',
    birthDate: next.date_of_birth ? next.date_of_birth.slice(0, 10) : '',
    cityId: next.city_id ?? '',
    avatarUrl: next.avatar_url ?? null,
    bio: next.bio ?? '',
    spokenLanguages: next.spoken_languages ?? [],
    nationalId: next.national_id_number ?? '',
    nationalExpiresAt: next.national_id_expires_at ? next.national_id_expires_at.slice(0, 10) : '',
    idDocsConsent: Boolean(next.id_docs_consent_at),
    nationalIdUrl: next.national_id_url ?? null,
    emergencyName: next.emergency_name ?? '',
    emergencyRegion: emergencyParts.region,
    emergencyLocal: emergencyParts.local,
  };
}

export default function OwnerProfile() {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile, signOut } = useAuth();
  const { cities } = useCatalog();
  const today = useToday();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<ProfileTab>('menu');
  const goHub = useCallback(() => setTab('menu'), []);
  useHubTabBack(tab === 'menu', goHub);
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
  const [bio, setBio] = useState('');
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>([]);
  const [nationalId, setNationalId] = useState('');
  const [nationalExpiresAt, setNationalExpiresAt] = useState('');
  const [idDocsConsent, setIdDocsConsent] = useState(false);
  const [nationalIdUrl, setNationalIdUrl] = useState<string | null>(null);
  const [nationalPreview, setNationalPreview] = useState<string | null>(null);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRegion, setEmergencyRegion] = useState<PhoneRegion>('ps');
  const [emergencyLocal, setEmergencyLocal] = useState('');
  const [listingCount, setListingCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const hydratedId = useRef<string | null>(null);
  const baseline = useRef<FormSnap | null>(null);
  const dirtyRef = useRef(false);

  const applyForm = useCallback((next: Profile) => {
    const snap = snapFromProfile(next);
    baseline.current = snap;
    setFullNameEn(snap.fullNameEn);
    setFullNameAr(snap.fullNameAr);
    setPhoneRegion(snap.phoneRegion);
    setPhoneLocal(snap.phoneLocal);
    setWaLinked(snap.waLinked);
    setWaRegion(snap.waRegion);
    setWaLocal(snap.waLocal);
    setGender(snap.gender);
    setBirthDate(snap.birthDate);
    setCityId(snap.cityId);
    setAvatarUrl(snap.avatarUrl);
    setBio(snap.bio);
    setSpokenLanguages(snap.spokenLanguages);
    setNationalId(snap.nationalId);
    setNationalExpiresAt(snap.nationalExpiresAt);
    setIdDocsConsent(snap.idDocsConsent);
    setNationalIdUrl(snap.nationalIdUrl);
    setEmergencyName(snap.emergencyName);
    setEmergencyRegion(snap.emergencyRegion);
    setEmergencyLocal(snap.emergencyLocal);
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (hydratedId.current === profile.id) return;
    hydratedId.current = profile.id;
    applyForm(profile);
  }, [profile, applyForm]);

  useEffect(() => {
    if (tabParam === 'security' || tabParam === 'account' || tabParam === 'trust' || tabParam === 'settings') {
      setTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    let active = true;
    void idDocUrl(nationalIdUrl).then((url) => {
      if (active) setNationalPreview(url);
    });
    return () => {
      active = false;
    };
  }, [nationalIdUrl]);

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
    if (!next) return;
    if (!dirtyRef.current) {
      applyForm(next);
      return;
    }
    alert(t('profile.discardEditsTitle'), t('profile.discardEditsBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.discardEdits'),
        style: 'destructive',
        onPress: () => applyForm(next),
      },
    ]);
  }, [loadListings, refreshProfile, applyForm, t]);

  const { refreshing, refresh } = useLiveReload(
    reloadAll,
    ['apartments', 'profiles'],
    `owner-profile:${profile?.id ?? ''}`,
    reloadPull,
  );

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

  const cleanPhoneNow = toE164(phoneRegion, phoneLocal);
  const cleanEmergency = toE164(emergencyRegion, emergencyLocal);
  const currentSnap: FormSnap = {
    fullNameEn,
    fullNameAr,
    phoneRegion,
    phoneLocal,
    waLinked,
    waRegion,
    waLocal,
    gender,
    birthDate,
    cityId,
    avatarUrl,
    bio,
    spokenLanguages,
    nationalId,
    nationalExpiresAt,
    idDocsConsent,
    nationalIdUrl,
    emergencyName,
    emergencyRegion,
    emergencyLocal,
  };
  const dirty = baseline.current != null && !snapsEqual(currentSnap, baseline.current);
  dirtyRef.current = dirty;
  const verification = accountVerification(profile);
  const trustIncomplete = Boolean(
    !isValidNationalId(nationalId) ||
      !isValidNationalIdExpiry(nationalExpiresAt) ||
      !nationalIdUrl ||
      !idDocsConsent ||
      profile?.id_verify_status !== 'approved' ||
      !isValidEmergencyName(emergencyName) ||
      !cleanEmergency ||
      cleanEmergency === cleanPhoneNow,
  );
  const accountIncomplete = Boolean(
    !fullNameEn.trim() ||
      !fullNameAr.trim() ||
      !gender ||
      !cityId ||
      !birthDate ||
      !phoneLocal.trim() ||
      !waLocal.trim() ||
      !avatarUrl,
  );

  const statusLabel =
    profile?.owner_status === 'approved'
      ? t('admin.ownerActive')
      : profile?.owner_status === 'rejected'
        ? t('admin.ownerSuspended')
        : t('admin.ownerWaiting');

  const banner =
    profile?.owner_status !== 'approved'
      ? { icon: 'hourglass' as const, text: statusLabel, onPress: () => setTab('account') }
      : accountIncomplete
        ? { icon: 'person-outline' as const, text: t('profile.completeHint'), onPress: () => setTab('account') }
        : trustIncomplete
          ? { icon: 'shield-outline' as const, text: t('menu.verification'), onPress: () => setTab('trust') }
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
      setAvatarUrl(uri);
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

  const uploadNational = async () => {
    if (!profile) return;
    if (!idDocsConsent) {
      alert(t('common.error'), t('profile.idConsentRequired'));
      return;
    }
    const uri = await pickIdCardPhoto();
    if (!uri) return;
    setUploadingDoc(true);
    setNationalIdUrl(uri);
    try {
      const path = await uploadIdDoc(profile.id, 'national', uri);
      const { error } = await supabase
        .from('profiles')
        .update({
          national_id_url: path,
          id_verify_status: 'pending',
          id_docs_consent_at: profile.id_docs_consent_at ?? new Date().toISOString(),
        })
        .eq('id', profile.id);
      if (error) {
        if (/national_id_url|id_verify_status|column/i.test(error.message)) {
          throw new Error(t('profile.idUploadDbMissing'));
        }
        throw error;
      }
      if (!profile.id_docs_consent_at) setIdDocsConsent(true);
      setNationalIdUrl(path);
      await refreshProfile();
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.idUploadFailed'));
    } finally {
      setUploadingDoc(false);
    }
  };

  const saveProfile = async () => {
    const accountMissing = [
      !avatarUrl && t('profile.photo'),
      !fullNameEn.trim() && t('common.nameEn'),
      !fullNameAr.trim() && t('common.nameAr'),
      !gender && t('profile.gender'),
      !cityId && t('auth.homeCity'),
      !birthDate && t('profile.birthDate'),
      !phoneLocal.trim() && t('common.phone'),
      !waLocal.trim() && t('profile.whatsapp'),
    ].filter(Boolean) as string[];
    if (!profile || accountMissing.length > 0) {
      alert(t('profile.stillNeeded'), accountMissing.join('\n') || t('profile.completeRequiredRenter'));
      setTab('account');
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
    if (!isValidBio(bio)) {
      alert(t('common.error'), t('profile.bioInvalid'));
      setTab('account');
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
    if (!isValidNationalId(nationalId)) {
      alert(t('common.error'), t('profile.nationalIdInvalid'));
      setTab('trust');
      return;
    }
    if (!isValidNationalIdExpiry(nationalExpiresAt)) {
      alert(
        t('common.error'),
        nationalIdExpiryState(nationalExpiresAt) === 'expired'
          ? t('profile.idExpired')
          : t('profile.idExpiryInvalid'),
      );
      setTab('trust');
      return;
    }
    if (!isValidEmergencyName(emergencyName)) {
      alert(t('common.error'), t('profile.emergencyNameInvalid'));
      setTab('trust');
      return;
    }
    if (!cleanEmergency || cleanEmergency === cleanPhone) {
      alert(t('common.error'), t('profile.emergencySamePhone'));
      setTab('trust');
      return;
    }
    if (!idDocsConsent || !nationalIdUrl) {
      alert(t('common.error'), t('profile.idConsentRequired'));
      setTab('trust');
      return;
    }

    setSaving(true);
    try {
      const ip = await fetchPublicIp();
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName(fullNameAr),
          full_name_en: cleanName(fullNameEn),
          phone: cleanPhone,
          whatsapp: cleanWhatsapp,
          gender,
          date_of_birth: birthDate,
          city_id: cityId,
          bio: bio.trim() || null,
          spoken_languages: spokenLanguages,
          national_id_number: sanitizeNationalId(nationalId) || null,
          national_id_expires_at: nationalExpiresAt || null,
          emergency_name: emergencyName.trim() || null,
          emergency_phone: cleanEmergency,
          id_docs_consent_at: profile.id_docs_consent_at ?? new Date().toISOString(),
          ...(ip ? { last_seen_ip: ip } : {}),
        })
        .eq('id', profile.id);
      if (error) throw error;
      const { error: nameError } = await supabase.auth.updateUser({
        data: { full_name_en: cleanName(fullNameEn) },
      });
      if (nameError) throw nameError;
      await refreshProfile();
      baseline.current = currentSnap;
      alert(t('common.done'), t('profile.saved'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const progressItems = [
    { id: 'photo', label: t('profile.photo'), done: Boolean(avatarUrl) },
    { id: 'nameEn', label: t('common.nameEn'), done: Boolean(fullNameEn.trim()) },
    { id: 'nameAr', label: t('common.nameAr'), done: Boolean(fullNameAr.trim()) },
    { id: 'gender', label: t('profile.gender'), done: Boolean(gender) },
    { id: 'city', label: t('auth.homeCity'), done: Boolean(cityId) },
    { id: 'birth', label: t('profile.birthDate'), done: Boolean(birthDate) },
    { id: 'phone', label: t('common.phone'), done: Boolean(phoneLocal.trim()) },
    { id: 'whatsapp', label: t('profile.whatsapp'), done: Boolean(waLocal.trim()) },
  ];
  const trustProgress = [
    { id: 'nationalId', label: t('profile.nationalId'), done: isValidNationalId(nationalId) },
    { id: 'nationalExpiry', label: t('profile.nationalIdExpiry'), done: isValidNationalIdExpiry(nationalExpiresAt) },
    { id: 'nationalCard', label: t('profile.nationalCard'), done: Boolean(nationalIdUrl) && idDocsConsent },
    { id: 'idVerified', label: t('profile.idVerified'), done: profile?.id_verify_status === 'approved' },
    { id: 'emergencyName', label: t('profile.emergencyName'), done: isValidEmergencyName(emergencyName) },
    {
      id: 'emergencyPhone',
      label: t('profile.emergencyPhone'),
      done: Boolean(cleanEmergency) && cleanEmergency !== cleanPhoneNow,
    },
  ];

  const jumpTo = (id: string) => {
    const trustIds = new Set([
      'nationalId',
      'nationalExpiry',
      'nationalCard',
      'idVerified',
      'emergencyName',
      'emergencyPhone',
    ]);
    setTab(trustIds.has(id) ? 'trust' : 'account');
  };

  const askLogout = () => {
    alert(t('common.logout'), t('common.confirmLogout'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.logout'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      back={tab !== 'menu'}
      onBack={goHub}
      footer={
        tab === 'account' || tab === 'trust' ? (
          <Button
            title={t('profile.saveProfile')}
            onPress={() => void saveProfile()}
            loading={saving}
            disabled={!dirty}
            pill
          />
        ) : null
      }
    >
      <OfflineBanner />
      <ProfileEnter scene={tab} reverse={tab === 'menu'}>
      {tab === 'menu' ? (
        <>
          <Text style={[{ fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' }, rtlText, { color: colors.accent }]}>
            {t('profile.title')}
          </Text>
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
            verifyStatus={profile?.id_verify_status}
            verifyRole="owner"
          />
          <ProfileBanner icon={banner.icon} text={banner.text} onPress={banner.onPress} />
          <ProfileProgress items={progressItems} onJump={jumpTo} readyLabel={t('owner.profileReady')} />
          <ProfileMenu
            onLogout={askLogout}
            links={[
              {
                key: 'account',
                icon: 'person-outline',
                label: t('profile.personalTitle'),
                dot: accountIncomplete,
                onPress: () => setTab('account'),
              },
              {
                key: 'trust',
                icon: 'shield-checkmark-outline',
                label: t('profile.tabTrust'),
                dot: trustIncomplete,
                onPress: () => setTab('trust'),
              },
              {
                key: 'settings',
                icon: 'options-outline',
                label: t('profile.tabSettings'),
                onPress: () => setTab('settings'),
              },
              {
                key: 'security',
                icon: 'lock-closed-outline',
                label: t('profile.tabSecurity'),
                onPress: () => setTab('security'),
              },
            ]}
          />
        </>
      ) : (
        <Text style={[{ fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' }, rtlText, { color: colors.accent }]}>
          {tab === 'account'
            ? t('profile.personalTitle')
            : tab === 'trust'
              ? t('profile.tabTrust')
              : tab === 'settings'
                ? t('profile.tabSettings')
                : t('profile.tabSecurity')}
        </Text>
      )}

      {tab === 'account' ? (
        <>
          <OwnerSeenCard
            title={t('profile.studentSeesOwner')}
            name={
              displayName({ full_name: fullNameAr, full_name_en: fullNameEn }, i18n.language) ||
              t('profile.title')
            }
            avatarUrl={avatarUrl}
            verifyStatus={profile?.id_verify_status}
            verifyRole="owner"
            bio={bio}
            lines={[
              ...(gender ? [{ icon: 'person-outline' as const, text: t(`profile.${gender}`) }] : []),
              ...(ageLabel(birthDate, t, today)
                ? [{ icon: 'hourglass-outline' as const, text: ageLabel(birthDate, t, today) }]
                : []),
              ...(cityName ? [{ icon: 'location-outline' as const, text: cityName }] : []),
              ...(phoneLocal.trim()
                ? [{ icon: 'call-outline' as const, text: `${regionPrefix(phoneRegion)} ${phoneLocal}` }]
                : []),
              ...(waLocal.trim()
                ? [{ icon: 'logo-whatsapp' as const, text: `${regionPrefix(waRegion)} ${waLocal}` }]
                : []),
              ...(spokenLanguages.length
                ? [
                    {
                      icon: 'chatbubbles-outline' as const,
                      text: spokenLanguages
                        .map((code) =>
                          code === 'ar'
                            ? t('profile.langAr')
                            : code === 'en'
                              ? t('profile.langEn')
                              : code === 'he'
                                ? t('profile.langHe')
                                : code,
                        )
                        .join(' · '),
                    },
                  ]
                : []),
            ].filter((item) => item.text)}
          />
          <ProfileProgress items={progressItems} onJump={jumpTo} readyLabel={t('owner.profileReady')} />
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
            bio={bio}
            onBio={setBio}
            bioHint={t('profile.bioHintOwner')}
            spokenLanguages={spokenLanguages}
            onSpokenLanguages={setSpokenLanguages}
          />
        </>
      ) : null}

      {tab === 'trust' && profile?.id_verify_status === 'rejected' ? (
        <Card compact>
          <Text style={[{ color: colors.danger, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }, rtlText]}>
            {profile.id_verify_note || t('menu.verifyRejectedHint')}
          </Text>
        </Card>
      ) : null}

      {tab === 'trust' ? (
        <>
          <ProfileProgress items={trustProgress} onJump={jumpTo} readyLabel={t('owner.profileReady')} />
          <ProfileSafetyFields
            isStudent={false}
            nationalId={nationalId}
            onNationalId={(value) => setNationalId(sanitizeNationalId(value))}
            nationalExpiresAt={nationalExpiresAt}
            onNationalExpiresAt={setNationalExpiresAt}
            idDocsConsent={idDocsConsent}
            onIdDocsConsent={setIdDocsConsent}
            nationalUri={nationalPreview}
            uploadingDoc={uploadingDoc}
            onUploadNational={() => void uploadNational()}
            onUploadUniversity={() => undefined}
            emergencyName={emergencyName}
            onEmergencyName={setEmergencyName}
            emergencyRegion={emergencyRegion}
            emergencyLocal={emergencyLocal}
            onEmergency={(region, local) => {
              setEmergencyRegion(region);
              setEmergencyLocal(local);
            }}
          />
          {verification?.pendingReview ? (
            <Card compact>
              <Text style={[{ color: colors.textMuted, fontFamily: 'Cairo_400Regular', fontSize: 12 }, rtlText]}>
                {t('menu.verifyReviewHint')}
              </Text>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'settings' && profile ? (
        <ProfileSettingsFields variant="owner" profile={profile} onSaved={() => void refreshProfile()} />
      ) : null}

      {tab === 'security' ? <ProfileSecurity mfaRequired /> : null}
      </ProfileEnter>
    </Screen>
  );
}
