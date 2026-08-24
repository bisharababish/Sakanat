import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
import { splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { colors } from '@/src/theme/colors';
import type { PersonGender } from '@/src/types/database';

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export default function AdminSettings() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart } = useLayout();
  const { profile, refreshProfile, signOut } = useAuth();
  const { cities } = useCatalog();
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
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile || !fullName.trim()) {
      Alert.alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    const cleanPhone = phoneLocal.trim() ? toE164(phoneRegion, phoneLocal) : null;
    if (phoneLocal.trim() && !cleanPhone) {
      Alert.alert(t('common.error'), t('phone.invalid'));
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
      Alert.alert(t('common.done'), t('profile.saved'));
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!profile?.email || !currentPassword || !newPassword) {
      Alert.alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('auth.weakPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('profile.passwordMismatch'));
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
      Alert.alert(t('common.done'), t('profile.passwordChanged'));
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
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
    if (error) Alert.alert(t('common.error'), error.message);
    else Alert.alert(t('common.done'));
  };

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('tabs.settings')}</Text>

      <Card>
        <Pressable style={styles.avatarWrap} onPress={() => void changePhoto()}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initials}>{initials(fullName || profile?.full_name)}</Text>
            </View>
          )}
          <Text style={styles.photoLabel}>{uploading ? t('common.loading') : t('profile.changePhoto')}</Text>
        </Pressable>
        <Text style={[styles.email, rtlText]}>{profile?.email}</Text>
        <Text style={[styles.meta, rtlText]}>
          {t('profile.role')}: {t('roles.admin')}
        </Text>
      </Card>

      <Card>
        <Input label={t('common.name')} value={fullName} onChangeText={setFullName} />
        <PhoneField
          label={t('common.phone')}
          region={phoneRegion}
          local={phoneLocal}
          onRegionChange={setPhoneRegion}
          onLocalChange={setPhoneLocal}
        />
        <Text style={[styles.label, rtlText]}>{t('profile.gender')}</Text>
        <View style={[styles.chipRow, { justifyContent: alignStart }]}>
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
        <Button title={t('profile.saveProfile')} onPress={saveProfile} loading={saving} />
      </Card>

      <Card>
        <Text style={[styles.section, rtlText]}>{t('profile.passwordTitle')}</Text>
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
        <Button title={t('profile.changePassword')} onPress={changePassword} loading={updatingPassword} />
      </Card>

      <Card>
        <Text style={[styles.section, rtlText]}>{t('admin.platformSettings')}</Text>
        <Input
          label={`${t('admin.commissionRate')} %`}
          value={percent}
          onChangeText={setPercent}
          keyboardType="numeric"
        />
        <Button title={t('admin.saveSettings')} onPress={saveCommission} loading={savingCommission} />
      </Card>

      <Button title={t('common.logout')} variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  avatarWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.primarySoft },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 32, fontWeight: '800', color: colors.primary },
  photoLabel: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  email: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted },
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
  section: { fontSize: 17, fontWeight: '800', color: colors.text },
});
