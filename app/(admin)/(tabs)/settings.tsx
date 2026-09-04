import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PasswordChecks } from '@/components/auth/PasswordChecks';
import { MfaSetup } from '@/components/auth/MfaSetup';
import { SessionSecurity } from '@/components/auth/SessionSecurity';
import { ProfileAccountFields } from '@/components/profile/ProfileAccountFields';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileSegments } from '@/components/profile/ProfileSegments';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { isPasswordValid } from '@/src/lib/password';
import { DEFAULT_COMMISSION_PERCENT } from '@/src/lib/commission';
import { sameMobile, splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { pickProfilePhoto } from '@/src/lib/pickImage';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { useColors } from '@/src/theme/ThemeProvider';
import type { PersonGender, Profile } from '@/src/types/database';

type ProfileTab = 'account' | 'security' | 'settings';

export default function AdminSettings() {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile } = useAuth();
  const { cities } = useCatalog();
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [percent, setPercent] = useState(String(DEFAULT_COMMISSION_PERCENT));
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
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

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('commission_percent')
      .eq('id', 1)
      .maybeSingle();
    if (data?.commission_percent != null) setPercent(String(data.commission_percent));
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadSettings(), refreshProfile()]);
  }, [loadSettings, refreshProfile]);

  const reloadPull = useCallback(async () => {
    const [, next] = await Promise.all([loadSettings(), refreshProfile()]);
    if (next) applyForm(next);
  }, [loadSettings, refreshProfile, applyForm]);

  const { refreshing, refresh } = useLiveReload(reloadAll, ['app_settings', 'profiles'], 'admin-settings', reloadPull);

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

  const changePassword = async () => {
    if (!profile?.email || !currentPassword || !newPassword) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      alert(t('common.error'), t('profile.passwordMismatch'));
      return;
    }
    if (!isPasswordValid(newPassword, confirmPassword)) {
      alert(t('common.error'), t('auth.weakPassword'));
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error: checkError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (checkError) throw checkError;
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert(t('common.done'), t('profile.passwordChanged'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const saveCommission = async () => {
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      alert(t('common.error'), t('admin.invalidCommission'));
      return;
    }
    setSavingCommission(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ commission_percent: value, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSavingCommission(false);
    if (error) alert(t('common.error'), error.message);
    else {
      setPercent(String(value));
      alert(t('common.done'));
    }
  };

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
          { icon: 'grid', text: t('admin.platformSettings') },
          ...(cityName ? [{ icon: 'location' as const, text: cityName }] : []),
        ]}
        chip={t('roles.admin')}
      />
      <ProfileBanner
        icon="cash"
        text={`${t('admin.commissionRate')}: ${percent}%`}
        onPress={() => setTab('settings')}
      />
      <ProfileSegments
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'account', icon: 'person', label: t('profile.tabAccount') },
          { key: 'security', icon: 'lock-closed', label: t('profile.tabSecurity') },
          { key: 'settings', icon: 'settings', label: t('profile.tabSettings') },
        ]}
      />

      {tab === 'account' ? (
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
      ) : null}

      {tab === 'security' ? (
        <>
          <Card>
            <SectionHead icon="lock-closed-outline" title={t('profile.passwordTitle')} />
            <Input
              label={t('profile.currentPassword')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <Input label={t('profile.newPassword')} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <Input
              label={t('profile.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <PasswordChecks password={newPassword} confirm={confirmPassword} />
            <Button title={t('profile.changePassword')} onPress={changePassword} loading={updatingPassword} pill />
          </Card>
          <MfaSetup required />
          <SessionSecurity />
        </>
      ) : null}

      {tab === 'settings' ? (
        <>
          <Card>
            <SectionHead icon="settings-outline" title={t('admin.platformSettings')} />
            <Input
              label={`${t('admin.commissionRate')} %`}
              value={percent}
              onChangeText={setPercent}
              keyboardType="numeric"
            />
            <Button title={t('admin.saveSettings')} onPress={saveCommission} loading={savingCommission} pill />
          </Card>
          <Card>
            <SectionHead icon="map-outline" title={t('admin.catalogTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.catalogHint')}</Text>
            <Button title={t('admin.openCatalog')} onPress={() => router.push('/(admin)/(tabs)/catalog')} pill />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14, fontFamily: 'Cairo_400Regular', lineHeight: 22 },
});
