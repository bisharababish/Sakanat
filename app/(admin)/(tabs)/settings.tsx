import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileSegments } from '@/components/profile/ProfileSegments';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { colors } from '@/src/theme/colors';
import type { PersonGender } from '@/src/types/database';

type ProfileTab = 'account' | 'security' | 'settings';

export default function AdminSettings() {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, row } = useLayout();
  const { profile, refreshProfile } = useAuth();
  const { cities } = useCatalog();
  const [tab, setTab] = useState<ProfileTab>('account');
  const [fullName, setFullName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [gender, setGender] = useState<PersonGender | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [cityId, setCityId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [percent, setPercent] = useState('10');
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    const phoneParts = splitPhone(profile.phone);
    setPhoneRegion(phoneParts.region);
    setPhoneLocal(phoneParts.local);
    setGender(profile.gender ?? '');
    setBirthDate(profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : '');
    setCityId(profile.city_id ?? '');
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('app_settings')
        .select('commission_percent')
        .eq('id', 1)
        .single()
        .then(({ data }) => {
          if (data?.commission_percent != null) setPercent(String(data.commission_percent));
        });
    }, []),
  );

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const cityName = useMemo(
    () => localizedName(cities.find((item) => item.id === cityId), i18n.language),
    [cities, cityId, i18n.language],
  );

  const changePhoto = async () => {
    if (!profile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(profile.id, result.assets[0].uri);
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
    if (!profile || !fullName.trim()) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    const cleanPhone = phoneLocal.trim() ? toE164(phoneRegion, phoneLocal) : null;
    if (phoneLocal.trim() && !cleanPhone) {
      alert(t('common.error'), t('phone.invalid'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: cleanPhone,
          gender: gender || null,
          date_of_birth: birthDate || null,
          city_id: cityId || null,
        })
        .eq('id', profile.id);
      if (error) throw error;
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
    if (newPassword.length < 6) {
      alert(t('common.error'), t('auth.weakPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      alert(t('common.error'), t('profile.passwordMismatch'));
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
    setSavingCommission(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ commission_percent: Number(percent), updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSavingCommission(false);
    if (error) alert(t('common.error'), error.message);
    else alert(t('common.done'));
  };

  return (
    <Screen>
      <ProfileHero
        name={fullName || profile?.full_name || t('profile.title')}
        avatarUrl={avatarUrl}
        uploading={uploading}
        onChangePhoto={() => void changePhoto()}
        metas={[
          { icon: 'grid', text: t('admin.platformSettings') },
          ...(cityName ? [{ icon: 'location' as const, text: cityName }] : []),
        ]}
        chip={t('roles.admin')}
        email={profile?.email}
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
        <>
          <Card>
            <SectionHead icon="person-outline" title={t('profile.personalTitle')} />
            <Input label={t('common.name')} value={fullName} onChangeText={setFullName} />
            <Text style={[styles.label, rtlText]}>{t('profile.gender')}</Text>
            <View style={[row, styles.chipRow, { flexDirection: 'row', justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
              <Chip label={t('profile.male')} selected={gender === 'male'} onPress={() => setGender('male')} />
              <Chip label={t('profile.female')} selected={gender === 'female'} onPress={() => setGender('female')} />
            </View>
            <DateField label={t('profile.birthDate')} value={birthDate} onChange={setBirthDate} />
            <Select
              label={t('common.city')}
              value={cityId}
              placeholder={t('common.select')}
              options={cityOptions}
              onChange={setCityId}
            />
          </Card>
          <Card>
            <SectionHead icon="call-outline" title={t('profile.contactTitle')} />
            <PhoneField
              label={t('common.phone')}
              region={phoneRegion}
              local={phoneLocal}
              onRegionChange={setPhoneRegion}
              onLocalChange={setPhoneLocal}
            />
            <Button title={t('profile.saveProfile')} onPress={saveProfile} loading={saving} pill />
          </Card>
        </>
      ) : null}

      {tab === 'security' ? (
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
          <Button title={t('profile.changePassword')} onPress={changePassword} loading={updatingPassword} pill />
        </Card>
      ) : null}

      {tab === 'settings' ? (
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
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
});
