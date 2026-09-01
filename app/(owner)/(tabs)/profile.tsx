import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
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
import { splitPhone, toE164, whatsappLink, type PhoneRegion } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { useColors } from '@/src/theme/ThemeProvider';
import type { PersonGender } from '@/src/types/database';

type ProfileTab = 'account' | 'security';

export default function OwnerProfile() {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl, row } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile } = useAuth();
  const { cities } = useCatalog();
  const [tab, setTab] = useState<ProfileTab>('account');
  const [fullName, setFullName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [waRegion, setWaRegion] = useState<PhoneRegion>('ps');
  const [waLocal, setWaLocal] = useState('');
  const [gender, setGender] = useState<PersonGender | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [cityId, setCityId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    const phoneParts = splitPhone(profile.phone);
    setPhoneRegion(phoneParts.region);
    setPhoneLocal(phoneParts.local);
    const waParts = splitPhone(profile.whatsapp);
    setWaRegion(waParts.region);
    setWaLocal(waParts.local);
    setGender(profile.gender ?? '');
    setBirthDate(profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : '');
    setCityId(profile.city_id ?? '');
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      void supabase
        .from('apartments')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', profile.id)
        .then(({ count }) => setListingCount(count ?? 0));
    }, [profile?.id]),
  );

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const cityName = useMemo(
    () => localizedName(cities.find((item) => item.id === cityId), i18n.language),
    [cities, cityId, i18n.language],
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
      : listingCount > 0
        ? {
            icon: 'home' as const,
            text: t('profile.listingCount', { count: listingCount }),
            onPress: () => router.push('/(owner)/(tabs)/listings'),
          }
        : !phoneLocal.trim() || !cityId
          ? { icon: 'sparkles' as const, text: t('profile.completeHint'), onPress: () => setTab('account') }
          : {
              icon: 'home' as const,
              text: t('tabs.listings'),
              onPress: () => router.push('/(owner)/(tabs)/listings'),
            };

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
    const cleanWhatsapp = waLocal.trim() ? toE164(waRegion, waLocal) : null;
    if (waLocal.trim() && !cleanWhatsapp) {
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
          whatsapp: cleanWhatsapp,
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

  return (
    <Screen>
      <ProfileHero
        name={fullName || profile?.full_name || t('profile.title')}
        avatarUrl={avatarUrl}
        uploading={uploading}
        onChangePhoto={() => void changePhoto()}
        metas={[
          { icon: 'shield-checkmark', text: statusLabel },
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
          { key: 'account', icon: 'person', label: t('profile.tabAccount') },
          { key: 'security', icon: 'lock-closed', label: t('profile.tabSecurity') },
        ]}
      />

      {tab === 'account' ? (
        <>
          <Card>
            <SectionHead icon="person-outline" title={t('profile.personalTitle')} />
            <Input label={t('common.name')} value={fullName} onChangeText={setFullName} />
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.gender')}</Text>
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
            <PhoneField
              label={t('profile.whatsapp')}
              region={waRegion}
              local={waLocal}
              onRegionChange={setWaRegion}
              onLocalChange={setWaLocal}
            />
            <Button
              title={t('profile.openWhatsapp')}
              variant="secondary"
              onPress={() => {
                const number = toE164(waRegion, waLocal);
                if (!number) {
                  alert(t('common.error'), t('phone.invalid'));
                  return;
                }
                void Linking.openURL(whatsappLink(number));
              }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
});
