import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileAccountFields } from '@/components/profile/ProfileAccountFields';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { ProfileSecurity } from '@/components/profile/ProfileSecurity';
import { Button } from '@/components/ui/Button';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { Screen } from '@/components/ui/Screen';
import { useAdminPendingCounts } from '@/src/hooks/useAdminPendingCounts';
import { useHubTabBack } from '@/src/hooks/useHubTabBack';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { DEFAULT_COMMISSION_PERCENT } from '@/src/lib/commission';
import { ageLabel, localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { sameMobile, splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { pickProfilePhoto } from '@/src/lib/pickImage';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { useColors } from '@/src/theme/ThemeProvider';
import type { PersonGender, Profile } from '@/src/types/database';

type ProfileTab = 'menu' | 'account' | 'security';

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
    a.avatarUrl === b.avatarUrl
  );
}

function snapFromProfile(next: Profile): FormSnap {
  const names = namesFromProfile(next.full_name, next.full_name_en);
  const phoneParts = splitPhone(next.phone);
  const waParts = splitPhone(next.whatsapp);
  const sameNumber = !waParts.local || (waParts.region === phoneParts.region && waParts.local === phoneParts.local);
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
  };
}

export default function AdminSettings() {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile } = useAuth();
  const { cities } = useCatalog();
  const today = useToday();
  const pending = useAdminPendingCounts();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<ProfileTab>('menu');
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
  const [percent, setPercent] = useState(String(DEFAULT_COMMISSION_PERCENT));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const hydratedId = useRef<string | null>(null);
  const baseline = useRef<FormSnap | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (tabParam === 'account' || tabParam === 'security') {
      setTab(tabParam);
    }
  }, [tabParam]);

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
  }, []);

  const goHub = useCallback(() => {
    const snap = baseline.current;
    if (snap) {
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
    }
    setTab('menu');
  }, []);
  useHubTabBack(tab === 'menu', goHub);

  useEffect(() => {
    if (!profile) return;
    if (hydratedId.current === profile.id) return;
    hydratedId.current = profile.id;
    applyForm(profile);
  }, [profile, applyForm]);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('commission_percent')
      .eq('id', 1)
      .maybeSingle();
    if (data?.commission_percent != null) setPercent(String(data.commission_percent));
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadSettings(), refreshProfile(), pending.refresh()]);
  }, [loadSettings, refreshProfile, pending.refresh]);

  const reloadPull = useCallback(async () => {
    const [, next] = await Promise.all([loadSettings(), refreshProfile(), pending.refresh()]);
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
  }, [loadSettings, refreshProfile, pending.refresh, applyForm, t]);

  const { refreshing, refresh } = useLiveReload(reloadAll, ['app_settings', 'profiles'], 'admin-settings', reloadPull);

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const cityName = useMemo(
    () => localizedName(cities.find((item) => item.id === cityId), i18n.language),
    [cities, cityId, i18n.language],
  );

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
  };
  const dirty = baseline.current != null && !snapsEqual(currentSnap, baseline.current);
  dirtyRef.current = dirty;

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

  const saveProfile = async () => {
    if (!profile || !fullNameEn.trim() || !fullNameAr.trim() || !phoneLocal.trim() || !waLocal.trim() || !gender || !cityId || !birthDate || !avatarUrl) {
      alert(t('common.error'), t('admin.completeRequired'));
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
          full_name_en: cleanName(fullNameEn),
          phone: cleanPhone,
          whatsapp: cleanWhatsapp,
          gender,
          date_of_birth: birthDate,
          city_id: cityId,
        })
        .eq('id', profile.id);
      if (error) throw error;
      const { error: nameError } = await supabase.auth.updateUser({
        data: {
          full_name: cleanName(fullNameAr),
          full_name_en: cleanName(fullNameEn),
        },
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
    { id: 'photo', label: t('profile.photo'), done: Boolean(avatarUrl) },
    { id: 'nameEn', label: t('common.nameEn'), done: Boolean(fullNameEn.trim()) },
    { id: 'nameAr', label: t('common.nameAr'), done: Boolean(fullNameAr.trim()) },
    { id: 'gender', label: t('profile.gender'), done: Boolean(gender) },
    { id: 'city', label: t('auth.homeCity'), done: Boolean(cityId) },
    { id: 'birth', label: t('profile.birthDate'), done: Boolean(birthDate) },
    { id: 'phone', label: t('common.phone'), done: Boolean(phoneLocal.trim()) },
    { id: 'whatsapp', label: t('profile.whatsapp'), done: Boolean(waLocal.trim()) },
  ];

  const pendingTotal = pending.owners + pending.ids + pending.listings + pending.bookings + pending.reports;
  const banner =
    incomplete
      ? {
          icon: 'person-outline' as const,
          text: t('admin.profileIncomplete'),
          onPress: () => setTab('account'),
        }
      : pendingTotal > 0
        ? {
            icon: 'flash-outline' as const,
            text: t('admin.queueBanner', { count: pendingTotal }),
            onPress: () => router.push('/(admin)/(tabs)'),
          }
        : {
            icon: 'cash-outline' as const,
            text: `${t('admin.commissionRate')}: ${percent}%`,
            onPress: () => router.push('/(admin)/ops'),
          };

  const photoBanner = {
    icon: avatarUrl ? ('image-outline' as const) : ('camera-outline' as const),
    text: avatarUrl ? t('profile.viewPhoto') : t('profile.addPhotoAction'),
    onPress: () => {
      if (avatarUrl) setViewingPhoto(true);
      else void changePhoto();
    },
  };

  return (
    <>
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      back={tab !== 'menu'}
      onBack={goHub}
      footer={
        tab === 'account' ? (
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
      <ProfileEnter scene={tab} reverse={tab === 'menu'}>
      {tab === 'menu' ? (
        <>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('profile.title')}</Text>
          <ProfileHero
            name={displayName({ full_name: fullNameAr, full_name_en: fullNameEn }, i18n.language) || t('profile.title')}
            avatarUrl={avatarUrl}
            uploading={uploading}
            onChangePhoto={() => void changePhoto()}
            onViewPhoto={avatarUrl ? () => setViewingPhoto(true) : undefined}
            metas={[
              { icon: 'shield-checkmark', text: t('roles.admin') },
              ...(ageLabel(birthDate, t, today)
                ? [{ icon: 'hourglass-outline' as const, text: ageLabel(birthDate, t, today) }]
                : []),
              ...(cityName ? [{ icon: 'location' as const, text: cityName }] : []),
            ]}
            chip={t('roles.admin')}
            email={profile?.email}
          />
          <ProfileBanner icon={photoBanner.icon} text={photoBanner.text} onPress={photoBanner.onPress} />
          <ProfileBanner icon={banner.icon} text={banner.text} onPress={banner.onPress} />
          <ProfileProgress
            items={progressItems.filter((item) => item.id !== 'photo')}
            onJump={() => setTab('account')}
            readyLabel={t('admin.profileReady')}
          />
          <ProfileMenu
            groups={[
              [
                {
                  key: 'account',
                  icon: 'person-outline',
                  label: t('profile.personalTitle'),
                  dot: incomplete,
                  onPress: () => setTab('account'),
                },
              ],
              [
                {
                  key: 'ops',
                  icon: 'options-outline',
                  label: t('admin.platformSettings'),
                  onPress: () => router.push('/(admin)/ops'),
                },
                {
                  key: 'audit',
                  icon: 'list-outline',
                  label: t('admin.auditTitle'),
                  onPress: () => router.push('/(admin)/audit'),
                },
                {
                  key: 'security',
                  icon: 'lock-closed-outline',
                  label: t('profile.tabSecurity'),
                  onPress: () => setTab('security'),
                },
              ],
            ]}
          />
        </>
      ) : (
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>
          {tab === 'account'
            ? t('profile.personalTitle')
            : t('profile.tabSecurity')}
        </Text>
      )}

      {tab === 'account' ? (
        <>
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

      {tab === 'security' ? <ProfileSecurity mfaRequired /> : null}
      </ProfileEnter>
    </Screen>
    <PhotoViewer
      photos={avatarUrl ? [avatarUrl] : []}
      index={0}
      visible={viewingPhoto && Boolean(avatarUrl)}
      onIndexChange={() => {}}
      onClose={() => setViewingPhoto(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
});
