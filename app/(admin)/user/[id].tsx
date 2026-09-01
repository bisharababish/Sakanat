import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Chip } from '@/components/ui/Chip';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { MAJORS, majorLabel } from '@/src/data/majors';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { deleteUserAccount, setSuspended } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';
import type { OwnerStatus, PersonGender, Profile, UserRole } from '@/src/types/database';

export default function AdminUserEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl } = useLayout();
  const colors = useColors();
  const { profile: me } = useAuth();
  const { cities, universities } = useCatalog();
  const [user, setUser] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [whatsRegion, setWhatsRegion] = useState<PhoneRegion>('ps');
  const [whatsLocal, setWhatsLocal] = useState('');
  const [gender, setGender] = useState<PersonGender | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [cityId, setCityId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus>('approved');
  const [studentId, setStudentId] = useState('');
  const [major, setMajor] = useState('');
  const [degreeLevel, setDegreeLevel] = useState('');
  const [studyYear, setStudyYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'active' | 'suspended'>('active');
  const chipAlign = { justifyContent: isRtl ? ('flex-end' as const) : ('flex-start' as const) };

  useEffect(() => {
    if (!id) return;
    supabase
      .from('profiles')
      .select('*, cities(*), universities(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const next = (data as Profile) ?? null;
        setUser(next);
        setLoaded(true);
        if (!next) return;
        setFullName(next.full_name ?? '');
        const phone = splitPhone(next.phone);
        setPhoneRegion(phone.region);
        setPhoneLocal(phone.local);
        const whats = splitPhone(next.whatsapp);
        setWhatsRegion(whats.region);
        setWhatsLocal(whats.local);
        setGender(next.gender ?? '');
        setBirthDate(next.date_of_birth ? next.date_of_birth.slice(0, 10) : '');
        setCityId(next.city_id ?? '');
        setUniversityId(next.university_id ?? '');
        setRole(next.role);
        setOwnerStatus(next.owner_status);
        setAccountStatus(next.account_status === 'suspended' ? 'suspended' : 'active');
        setStudentId(next.student_id_number ?? '');
        setMajor(next.major ?? '');
        setDegreeLevel(next.degree_level ?? '');
        setStudyYear(next.study_year && next.study_year !== 'graduate' ? next.study_year : '');
      });
  }, [id]);

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, i18n.language) })),
    [cities, i18n.language],
  );
  const universityOptions = useMemo(
    () =>
      universities.map((item) => ({
        value: item.id,
        label: item.cities
          ? `${localizedName(item, i18n.language)} — ${localizedName(item.cities, i18n.language)}`
          : localizedName(item, i18n.language),
      })),
    [universities, i18n.language],
  );
  const majorOptions = useMemo(
    () => MAJORS.map((item) => ({ value: item.value, label: majorLabel(item.value, i18n.language) })),
    [i18n.language],
  );

  const save = async () => {
    if (!user || !fullName.trim()) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    const phone = phoneLocal.trim() ? toE164(phoneRegion, phoneLocal) : null;
    const whatsapp = whatsLocal.trim() ? toE164(whatsRegion, whatsLocal) : null;
    if (phoneLocal.trim() && !phone) {
      alert(t('common.error'), t('phone.invalid'));
      return;
    }
    const nextRole = user.role === 'admin' ? 'admin' : role;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone,
          whatsapp,
          gender: gender || null,
          date_of_birth: birthDate || null,
          city_id: cityId || null,
          university_id: universityId || null,
          role: nextRole,
          owner_status: nextRole === 'owner' ? ownerStatus : user.owner_status,
          student_id_number: studentId.trim() || null,
          major: major || null,
          degree_level: degreeLevel || null,
          study_year: studyYear || null,
        })
        .eq('id', user.id);
      if (error) throw error;
      if (nextRole === 'owner' && ownerStatus === 'rejected') {
        await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', user.id);
      }
      alert(t('common.done'), t('profile.saved'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = () => {
    if (!user || user.role === 'admin' || user.id === me?.id) return;
    const next = accountStatus !== 'suspended';
    alert(
      next ? t('admin.suspend') : t('admin.restoreAccount'),
      next ? t('admin.confirmSuspend') : t('admin.confirmRestore'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: next ? t('admin.suspend') : t('admin.restoreAccount'),
          style: next ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await setSuspended(user, next);
              setAccountStatus(next ? 'suspended' : 'active');
              setUser({ ...user, account_status: next ? 'suspended' : 'active' });
              if (user.role === 'owner') setOwnerStatus(next ? 'rejected' : 'approved');
              alert(t('common.done'), next ? t('admin.accountSuspended') : t('admin.accountActive'));
            } catch (err) {
              alert(t('common.error'), err instanceof Error ? err.message : '');
            }
          },
        },
      ],
    );
  };

  const removeUser = () => {
    if (!user || user.role === 'admin' || user.id === me?.id) return;
    alert(t('admin.deleteUser'), t('admin.confirmDeleteUser'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUserAccount(user.id);
            router.back();
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ChromeBar back />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {loaded ? (
            <Text style={[styles.muted, rtlText, { color: colors.textMuted }]}>{t('admin.noUsers')}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Screen back>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.editUser')}</Text>
      <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>{user.email}</Text>
      {accountStatus === 'suspended' ? <StatusBadge label={t('admin.accountSuspended')} tone="rejected" /> : null}
      {user.accepted_terms_at ? (
        <Text style={[styles.sub, rtlText, { color: colors.textMuted }]}>
          {t('admin.acceptedTerms')}: {user.accepted_terms_at.slice(0, 10)}
        </Text>
      ) : null}

      <Card>
        <SectionHead icon="person-outline" title={t('profile.personalTitle')} />
        <Input label={t('common.name')} value={fullName} onChangeText={setFullName} />
        <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.gender')}</Text>
        <View style={[styles.chips, chipAlign]}>
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
        <SearchSelect
          label={t('common.university')}
          value={universityId}
          placeholder={t('common.select')}
          options={universityOptions}
          onChange={setUniversityId}
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
          region={whatsRegion}
          local={whatsLocal}
          onRegionChange={setWhatsRegion}
          onLocalChange={setWhatsLocal}
        />
      </Card>

      {user.role !== 'admin' ? (
        <Card>
          <SectionHead icon="shield-outline" title={t('profile.role')} />
          <View style={[styles.chips, chipAlign]}>
            <Chip label={t('roles.student')} selected={role === 'student'} onPress={() => setRole('student')} />
            <Chip label={t('roles.renter')} selected={role === 'renter'} onPress={() => setRole('renter')} />
            <Chip label={t('roles.owner')} selected={role === 'owner'} onPress={() => setRole('owner')} />
          </View>
          {role === 'owner' ? (
            <>
              <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('admin.ownerStatus')}</Text>
              <View style={[styles.chips, chipAlign]}>
                <Chip
                  label={t('admin.ownerWaiting')}
                  selected={ownerStatus === 'pending'}
                  onPress={() => setOwnerStatus('pending')}
                />
                <Chip
                  label={t('admin.ownerActive')}
                  selected={ownerStatus === 'approved'}
                  onPress={() => setOwnerStatus('approved')}
                />
                <Chip
                  label={t('admin.ownerSuspended')}
                  selected={ownerStatus === 'rejected'}
                  onPress={() => setOwnerStatus('rejected')}
                />
              </View>
            </>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('roles.admin')}</Text>
        </Card>
      )}

      {role === 'student' ? (
        <Card>
          <SectionHead icon="school-outline" title={t('profile.studiesTitle')} />
          <Input label={t('profile.studentId')} value={studentId} onChangeText={setStudentId} keyboardType="number-pad" />
          <SearchSelect
            label={t('profile.major')}
            value={major}
            placeholder={t('profile.searchMajor')}
            options={majorOptions}
            onChange={setMajor}
          />
          <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.degree')}</Text>
          <View style={[styles.chips, chipAlign]}>
            {(['bachelor', 'master', 'doctorate', 'diploma', 'otherDegree'] as const).map((value) => (
              <Chip
                key={value}
                label={t(`profile.${value}`)}
                selected={degreeLevel === (value === 'otherDegree' ? 'other' : value)}
                onPress={() => setDegreeLevel(value === 'otherDegree' ? 'other' : value)}
              />
            ))}
          </View>
          <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.studyYear')}</Text>
          <View style={[styles.chips, chipAlign]}>
            {(['1', '2', '3', '4', '5'] as const).map((value) => (
              <Chip
                key={value}
                label={t(`profile.year${value}`)}
                selected={studyYear === value}
                onPress={() => setStudyYear(value)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <Button title={t('common.save')} onPress={() => void save()} loading={saving} pill />
      {user.role !== 'admin' && user.id !== me?.id ? (
        <>
          <Button
            title={accountStatus === 'suspended' ? t('admin.restoreAccount') : t('admin.suspend')}
            variant={accountStatus === 'suspended' ? 'secondary' : 'danger'}
            onPress={toggleSuspend}
            pill
          />
          <Button title={t('admin.deleteUser')} variant="danger" onPress={removeUser} pill />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  sub: { fontSize: 14, fontFamily: 'Cairo_400Regular', marginTop: -4 },
  label: { fontWeight: '800', fontFamily: 'Cairo_700Bold', fontSize: 14 },
  muted: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
