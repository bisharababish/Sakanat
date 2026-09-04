import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListingCard } from '@/components/ListingCard';
import { OwnerSeenCard } from '@/components/profile/OwnerSeenCard';
import { ProfileAccountFields } from '@/components/profile/ProfileAccountFields';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileSegments } from '@/components/profile/ProfileSegments';
import { SectionHead } from '@/components/profile/SectionHead';
import { PasswordChecks } from '@/components/auth/PasswordChecks';
import { MfaSetup } from '@/components/auth/MfaSetup';
import { SessionSecurity } from '@/components/auth/SessionSecurity';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { MAJORS, majorLabel } from '@/src/data/majors';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { deleteOwnAccount } from '@/src/lib/moderation';
import { listingDistanceKm } from '@/src/lib/distance';
import { LISTING_PAGE_SIZE } from '@/src/lib/page';
import { ageLabel, localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { isPasswordValid } from '@/src/lib/password';
import { formatEmailDomains, studentEmailError } from '@/src/lib/eduEmail';
import { isValidStudentId, regionPrefix, sameMobile, sanitizeStudentId, splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { loadSavedApartments, toggleSavedApartment } from '@/src/lib/saved';
import { pickProfilePhoto } from '@/src/lib/pickImage';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, PersonGender, Profile } from '@/src/types/database';

type ProfileTab = 'account' | 'saved' | 'security';

export default function StudentProfileScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile, signOut } = useAuth();
  const { resumeBook } = useLocalSearchParams<{ resumeBook?: string }>();
  const resumeId = typeof resumeBook === 'string' ? resumeBook : undefined;
  const { cities, universities } = useCatalog();
  const today = useToday();
  const [tab, setTab] = useState<ProfileTab>('account');
  const [fullNameEn, setFullNameEn] = useState('');
  const [fullNameAr, setFullNameAr] = useState('');
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
  const [waLinked, setWaLinked] = useState(true);
  const hydratedId = useRef<string | null>(null);

  const applyForm = useCallback((next: Profile) => {
    const names = namesFromProfile(next.full_name, next.full_name_en);
    setFullNameEn(names.en);
    setFullNameAr(names.ar);
    const phoneParts = splitPhone(next.phone);
    setPhoneRegion(phoneParts.region);
    setPhoneLocal(phoneParts.local);
    setStudentId(next.student_id_number ?? '');
    const waParts = splitPhone(next.whatsapp);
    const sameNumber = !waParts.local || (waParts.region === phoneParts.region && waParts.local === phoneParts.local);
    setWaLinked(sameNumber);
    setWaRegion(sameNumber ? phoneParts.region : waParts.region);
    setWaLocal(sameNumber ? phoneParts.local : waParts.local);
    setMajor(next.major ?? '');
    setDegreeLevel(
      next.degree_level ?? (next.study_year === 'graduate' ? 'master' : next.study_year ? 'bachelor' : ''),
    );
    setStudyYear(next.study_year && next.study_year !== 'graduate' ? next.study_year : '');
    setGender(next.gender ?? '');
    setBirthDate(next.date_of_birth ? next.date_of_birth.slice(0, 10) : '');
    setCityId(next.city_id ?? '');
    setUniversityId(next.university_id ?? '');
    setAvatarUrl(next.avatar_url ?? null);
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (hydratedId.current === profile.id) return;
    hydratedId.current = profile.id;
    applyForm(profile);
  }, [profile, applyForm]);

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
  const incomplete = Boolean(
    !fullNameEn.trim() ||
      !fullNameAr.trim() ||
      !gender ||
      !cityId ||
      !birthDate ||
      !phoneLocal.trim() ||
      !waLocal.trim() ||
      !avatarUrl ||
      (isStudent &&
        (!universityId || !studentId.trim() || !major || !degreeLevel || !studyYear)),
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

  const reloadPull = useCallback(async () => {
    const [, next] = await Promise.all([reloadSaved(), refreshProfile()]);
    if (next) applyForm(next);
  }, [reloadSaved, refreshProfile, applyForm]);

  const { refreshing, refresh } = useLiveReload(
    reloadAll,
    ['saved_apartments', 'apartments', 'profiles'],
    `saved:${profile?.id ?? ''}`,
    reloadPull,
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
    if (
      !profile ||
      !fullNameEn.trim() ||
      !fullNameAr.trim() ||
      !phoneLocal.trim() ||
      !waLocal.trim() ||
      !gender ||
      !cityId ||
      !birthDate ||
      !avatarUrl ||
      (isStudent && (!universityId || !studentId.trim() || !major || !degreeLevel || !studyYear))
    ) {
      alert(t('common.error'), t(isStudent ? 'profile.completeRequired' : 'profile.completeRequiredRenter'));
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
    if (isStudent && !isValidStudentId(studentId)) {
      alert(t('common.error'), t('auth.missingFields'));
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
          full_name: cleanName(fullNameAr),
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
      const { error: nameError } = await supabase.auth.updateUser({
        data: { full_name_en: cleanName(fullNameEn) },
      });
      if (nameError) throw nameError;
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
    ...(isStudent && studyYear
      ? [{ icon: 'book-outline' as const, text: yearOptions.find((item) => item.value === studyYear)?.label ?? '' }]
      : []),
    ...((cityName || (isStudent && universityName))
      ? [{ icon: 'location' as const, text: [isStudent ? universityName : '', cityName].filter(Boolean).join(' · ') }]
      : []),
  ].filter((item) => item.text);

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
        metas={heroMetas}
        chip={t(`roles.${profile?.role ?? 'student'}`)}
      />
      <ProfileBanner icon={banner.icon} text={banner.text} onPress={banner.onPress} />
      <ProfileSegments
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'account', icon: 'person', label: t('profile.tabAccount'), dot: incomplete },
          { key: 'saved', icon: 'heart', label: t('profile.tabSaved'), badge: savedListings.length },
          { key: 'security', icon: 'lock-closed', label: t('profile.tabSecurity') },
        ]}
      />

      {tab === 'account' ? (
        <>
          <OwnerSeenCard
            title={t('profile.ownerSees')}
            name={fullNameAr.trim() || t('profile.title')}
            avatarUrl={avatarUrl}
            lines={[
              ...(gender ? [{ icon: 'person-outline' as const, text: t(`profile.${gender}`) }] : []),
              ...(ageLabel(birthDate, t, today)
                ? [{ icon: 'hourglass-outline' as const, text: ageLabel(birthDate, t, today) }]
                : []),
              ...(isStudent && universityName ? [{ icon: 'school-outline' as const, text: universityName }] : []),
              ...(cityName ? [{ icon: 'location-outline' as const, text: cityName }] : []),
              ...(isStudent && majorName ? [{ icon: 'book-outline' as const, text: majorName }] : []),
              ...(isStudent && studyYear
                ? [
                    {
                      icon: 'calendar-outline' as const,
                      text: yearOptions.find((item) => item.value === studyYear)?.label ?? '',
                    },
                  ]
                : []),
              ...(phoneLocal.trim()
                ? [{ icon: 'call-outline' as const, text: `${regionPrefix(phoneRegion)} ${phoneLocal}` }]
                : []),
            ].filter((item) => item.text)}
          />
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
          {isStudent ? (
            <Card>
              <SectionHead icon="school-outline" title={t('profile.studiesTitle')} />
              <SearchSelect
                label={t('auth.studyUniversity')}
                value={universityId}
                placeholder={t('common.select')}
                options={universityOptions}
                onChange={setUniversityId}
              />
              <Input
                label={t('profile.studentId')}
                value={studentId}
                onChangeText={(value) => setStudentId(sanitizeStudentId(value))}
                autoCapitalize="none"
                ltr
              />
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
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'saved' ? (
        <Card>
          <SectionHead
            icon="heart-outline"
            title={
              savedListings.length > 0
                ? t('profile.savedCount', { count: savedListings.length })
                : t('profile.savedListings')
            }
          />
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
  warn: {
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  warnText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_600SemiBold' },
});

