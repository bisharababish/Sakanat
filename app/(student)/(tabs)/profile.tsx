import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListingCard } from '@/components/ListingCard';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileSegments } from '@/components/profile/ProfileSegments';
import { SectionHead } from '@/components/profile/SectionHead';
import { PasswordChecks } from '@/components/auth/PasswordChecks';
import { MfaSetup } from '@/components/auth/MfaSetup';
import { SessionSecurity } from '@/components/auth/SessionSecurity';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Pager } from '@/components/ui/Pager';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { MAJORS, majorLabel } from '@/src/data/majors';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useAuth } from '@/src/lib/auth';
import { deleteOwnAccount } from '@/src/lib/moderation';
import { listingDistanceKm } from '@/src/lib/distance';
import { LISTING_PAGE_SIZE } from '@/src/lib/page';
import { localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { NAME_MAX, cleanName, isValidName, sanitizeNameInput } from '@/src/lib/name';
import { isPasswordValid } from '@/src/lib/password';
import { formatEmailDomains, studentEmailError } from '@/src/lib/eduEmail';
import { isValidStudentId, splitPhone, toE164, whatsappLink, type PhoneRegion } from '@/src/lib/phone';
import { loadSavedApartments, toggleSavedApartment } from '@/src/lib/saved';
import { pickProfilePhoto } from '@/src/lib/pickImage';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, PersonGender } from '@/src/types/database';

type ProfileTab = 'account' | 'saved' | 'security';

export default function StudentProfileScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile, signOut } = useAuth();
  const { resumeBook } = useLocalSearchParams<{ resumeBook?: string }>();
  const resumeId = typeof resumeBook === 'string' ? resumeBook : undefined;
  const { cities, universities } = useCatalog();
  const [tab, setTab] = useState<ProfileTab>('account');
  const [fullName, setFullName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [studentId, setStudentId] = useState('');
  const [gender, setGender] = useState<PersonGender | ''>('');
  const [birthDate, setBirthDate] = useState('');
  const [waRegion, setWaRegion] = useState<PhoneRegion>('ps');
  const [waLocal, setWaLocal] = useState('');
  const [major, setMajor] = useState('');
  const [degreeLevel, setDegreeLevel] = useState('');
  const [studyYear, setStudyYear] = useState('');
  const [cityId, setCityId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savedListings, setSavedListings] = useState<Apartment[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    const phoneParts = splitPhone(profile.phone);
    setPhoneRegion(phoneParts.region);
    setPhoneLocal(phoneParts.local);
    setStudentId(profile.student_id_number ?? '');
    const waParts = splitPhone(profile.whatsapp);
    setWaRegion(waParts.region);
    setWaLocal(waParts.local);
    setMajor(profile.major ?? '');
    setDegreeLevel(
      profile.degree_level ?? (profile.study_year === 'graduate' ? 'master' : profile.study_year ? 'bachelor' : ''),
    );
    setStudyYear(profile.study_year && profile.study_year !== 'graduate' ? profile.study_year : '');
    setGender(profile.gender ?? '');
    setBirthDate(profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : '');
    setCityId(profile.city_id ?? '');
    setUniversityId(profile.university_id ?? '');
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  useEffect(() => {
    if (resumeId) setTab('account');
  }, [resumeId]);

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
  const yearOptions = useMemo(
    () => [
      { value: '1', label: t('profile.year1') },
      { value: '2', label: t('profile.year2') },
      { value: '3', label: t('profile.year3') },
      { value: '4', label: t('profile.year4') },
      { value: '5', label: t('profile.year5') },
      { value: '6', label: t('profile.year6') },
    ],
    [t],
  );
  const degreeOptions = useMemo(
    () => [
      { value: 'bachelor', label: t('profile.bachelor') },
      { value: 'master', label: t('profile.master') },
      { value: 'doctorate', label: t('profile.doctorate') },
      { value: 'diploma', label: t('profile.diploma') },
      { value: 'other', label: t('profile.otherDegree') },
    ],
    [t],
  );
  const majorOptions = useMemo(
    () => MAJORS.map((item) => ({ value: item.value, label: majorLabel(item.value, i18n.language) })),
    [i18n.language],
  );

  const cityName = useMemo(
    () => localizedName(cities.find((item) => item.id === cityId), i18n.language),
    [cities, cityId, i18n.language],
  );
  const universityName = useMemo(
    () => localizedName(universities.find((item) => item.id === universityId), i18n.language),
    [universities, universityId, i18n.language],
  );
  const universityDomains = useMemo(
    () => formatEmailDomains(universities.find((item) => item.id === universityId)?.email_domains),
    [universities, universityId],
  );
  const majorName = major ? majorLabel(major, i18n.language) : '';
  const isStudent = profile?.role !== 'renter';
  const incomplete =
    !fullName.trim() || !gender || !cityId || !phoneLocal.trim() || (isStudent && !universityId);
  const need = (ok: boolean, label: string) => (incomplete && !ok ? `${label} · ${t('common.required')}` : label);
  const savedPaged = usePaged(savedListings, LISTING_PAGE_SIZE, String(savedListings.length));

  const reloadSaved = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setSavedListings(await loadSavedApartments(profile.id));
    } catch {
      setSavedListings([]);
    }
  }, [profile?.id]);

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadSaved(), refreshProfile()]);
  }, [reloadSaved, refreshProfile]);

  const { refreshing, refresh } = useLiveReload(
    reloadAll,
    ['saved_apartments', 'apartments', 'profiles'],
    `saved:${profile?.id ?? ''}`,
  );

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
    if (!profile || !fullName.trim() || !phoneLocal.trim() || !gender || !cityId || (isStudent && !universityId)) {
      alert(t('common.error'), t(isStudent ? 'profile.completeRequired' : 'profile.completeRequiredRenter'));
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
    if (isStudent && studentId.trim() && !isValidStudentId(studentId)) {
      alert(t('common.error'), t('profile.studentIdHint'));
      return;
    }
    if (!isValidName(fullName)) {
      alert(t('common.error'), t('auth.invalidName'));
      return;
    }
    if (isStudent && universityId !== (profile.university_id ?? '')) {
      const emailIssue = studentEmailError(profile.email, universityDomains);
      if (emailIssue === 'universityEmailMismatch') {
        alert(t('common.error'), t('auth.universityEmailMismatch', { domains: universityDomains.join(', ') }));
        return;
      }
      if (emailIssue) {
        alert(t('common.error'), t(`auth.${emailIssue}`));
        return;
      }
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName(fullName),
          phone: cleanPhone,
          student_id_number: isStudent ? studentId.trim() || null : null,
          whatsapp: cleanWhatsapp,
          major: isStudent ? major || null : null,
          degree_level: isStudent ? degreeLevel || null : null,
          study_year: isStudent ? studyYear || null : null,
          gender: gender || null,
          date_of_birth: birthDate || null,
          city_id: cityId || null,
          university_id: isStudent ? universityId || null : null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      if (resumeId) {
        alert(t('common.done'), t('profile.saved'), [
          { text: t('common.done') },
          {
            text: t('profile.continueBooking'),
            onPress: () => router.replace({ pathname: '/(student)/book/[id]', params: { id: resumeId } }),
          },
        ]);
      } else {
        alert(t('common.done'), t('profile.saved'));
      }
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

  const canDeleteAccount = profile?.role === 'student' || profile?.role === 'renter';

  const removeAccount = () => {
    if (!canDeleteAccount) return;
    alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteOwnAccount();
            await signOut();
          } catch {
            alert(t('common.error'), t('profile.deleteAccountFailed'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const banner = resumeId
    ? incomplete
      ? {
          icon: 'sparkles' as const,
          text: t('profile.completeHint'),
          onPress: () => setTab('account'),
        }
      : {
          icon: 'calendar' as const,
          text: t('profile.continueBooking'),
          onPress: () => router.replace({ pathname: '/(student)/book/[id]', params: { id: resumeId } }),
        }
    : savedListings.length > 0
      ? {
          icon: 'heart' as const,
          text: t('profile.savedCount', { count: savedListings.length }),
          onPress: () => setTab('saved'),
        }
      : incomplete
        ? {
            icon: 'sparkles' as const,
            text: t('profile.completeHint'),
            onPress: () => setTab('account'),
          }
        : {
            icon: 'search' as const,
            text: t('profile.browseListings'),
            onPress: () => router.push('/(student)/(tabs)/search'),
          };

  const heroMetas = [
    ...(isStudent && majorName ? [{ icon: 'school' as const, text: majorName }] : []),
    ...((cityName || (isStudent && universityName))
      ? [{ icon: 'location' as const, text: [isStudent ? universityName : '', cityName].filter(Boolean).join(' · ') }]
      : []),
  ];

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
      <ProfileHero
        name={fullName || profile?.full_name || t('profile.title')}
        avatarUrl={avatarUrl}
        uploading={uploading}
        onChangePhoto={() => void changePhoto()}
        metas={heroMetas}
        chip={t(`roles.${profile?.role ?? 'student'}`)}
        email={profile?.email}
      />
      <ProfileBanner icon={banner.icon} text={banner.text} onPress={banner.onPress} />
      <ProfileSegments
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'account', icon: 'person', label: t('profile.tabAccount') },
          { key: 'saved', icon: 'heart', label: t('profile.tabSaved'), badge: savedListings.length },
          { key: 'security', icon: 'lock-closed', label: t('profile.tabSecurity') },
        ]}
      />

      {tab === 'account' ? (
        <>
          <Card>
            <SectionHead icon="person-outline" title={t('profile.personalTitle')} />
            <Input
              label={need(Boolean(fullName.trim()), t('common.name'))}
              value={fullName}
              onChangeText={(value) => setFullName(sanitizeNameInput(value))}
              hint={t('profile.nameHint')}
              autoCapitalize="words"
              maxLength={NAME_MAX}
            />
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{need(Boolean(gender), t('profile.gender'))}</Text>
            <FilterPills
              value={gender}
              onChange={setGender}
              items={[
                { value: 'male', label: t('profile.male') },
                { value: 'female', label: t('profile.female') },
              ]}
            />
            <DateField label={t('profile.birthDate')} value={birthDate} onChange={setBirthDate} />
            <Select
              label={need(Boolean(cityId), t('auth.homeCity'))}
              value={cityId}
              placeholder={t('common.select')}
              options={cityOptions}
              onChange={setCityId}
            />
          </Card>

          <Card>
            <SectionHead icon="call-outline" title={t('profile.contactTitle')} />
            <PhoneField
              label={need(Boolean(phoneLocal.trim()), t('common.phone'))}
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
            {isStudent ? (
              <Input
                label={t('profile.studentId')}
                value={studentId}
                onChangeText={(value) => setStudentId(value.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                hint={t('profile.studentIdHint')}
                autoCapitalize="none"
                ltr
              />
            ) : null}
          </Card>

          {isStudent ? (
            <Card>
              <SectionHead icon="school-outline" title={t('profile.studiesTitle')} />
              <SearchSelect
                label={t('profile.major')}
                value={major}
                placeholder={t('profile.searchMajor')}
                options={majorOptions}
                onChange={setMajor}
              />
              <Select
                label={t('profile.degree')}
                value={degreeLevel}
                placeholder={t('common.select')}
                options={degreeOptions}
                onChange={setDegreeLevel}
              />
              <Select
                label={t('profile.studyYear')}
                value={studyYear}
                placeholder={t('common.select')}
                options={yearOptions}
                onChange={setStudyYear}
              />
              <SearchSelect
                label={need(Boolean(universityId), t('auth.studyUniversity'))}
                value={universityId}
                placeholder={t('common.select')}
                options={universityOptions}
                onChange={setUniversityId}
              />
              {isStudent && universityId ? (
                <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
                  {universityDomains.length
                    ? t('auth.universityEmailHint', { domains: universityDomains.join(', ') })
                    : t('auth.studentEmailHint')}
                </Text>
              ) : null}
            </Card>
          ) : null}
          <Button title={t('profile.saveProfile')} onPress={saveProfile} loading={saving} pill />
        </>
      ) : null}

      {tab === 'saved' ? (
        <Card>
          <SectionHead icon="heart-outline" title={t('profile.savedListings')} />
          {savedListings.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="home-outline" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, rtlText, { color: colors.textMuted }]}>{t('profile.savedEmpty')}</Text>
              <Button
                title={t('profile.browseListings')}
                onPress={() => router.push('/(student)/(tabs)/search')}
                pill
              />
            </View>
          ) : (
            savedPaged.slice.map((item) => (
              <View key={item.id} style={styles.savedBlock}>
                <ListingCard
                  apartment={item}
                  university={isStudent ? item.universities : null}
                  distanceKm={
                    isStudent ? item.campus_distance_km : listingDistanceKm(item, null, item.cities)
                  }
                  distancePlace={isStudent ? 'campus' : 'city'}
                  saved
                  onToggleSave={async () => {
                    if (!profile) return;
                    await toggleSavedApartment(profile.id, item.id, true);
                    await reloadSaved();
                  }}
                  onPress={() =>
                    router.push({
                      pathname: '/(student)/apartment/[id]',
                      params: {
                        id: item.id,
                        universityId: isStudent ? universityId || '' : '',
                        from: isStudent ? 'campus' : 'city',
                      },
                    })
                  }
                />
              </View>
            ))
          )}
          {savedListings.length > 0 ? (
            <Pager
              page={savedPaged.page}
              pages={savedPaged.pages}
              from={savedPaged.from}
              to={savedPaged.to}
              total={savedPaged.total}
              pageSize={savedPaged.pageSize}
              onPage={savedPaged.setPage}
            />
          ) : null}
        </Card>
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
            <Input
              label={t('profile.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Input
              label={t('profile.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <PasswordChecks password={newPassword} confirm={confirmPassword} />
            <Button title={t('profile.changePassword')} onPress={changePassword} loading={updatingPassword} pill />
          </Card>
          <MfaSetup />
          <SessionSecurity />
          {canDeleteAccount ? (
            <Card>
              <SectionHead icon="trash-outline" title={t('profile.deleteAccount')} />
              <Text style={[styles.emptyText, rtlText, { color: colors.textMuted }]}>
                {t('profile.deleteAccountHint')}
              </Text>
              <Button
                title={t('profile.deleteAccount')}
                variant="danger"
                onPress={removeAccount}
                loading={deleting}
                pill
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  savedBlock: { gap: 8 },
  emptyBox: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
  hint: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_400Regular' },
});

