import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IdReviewCard } from '@/components/profile/IdReviewCard';
import { NameField } from '@/components/profile/NameField';
import { ProfileSegments } from '@/components/profile/ProfileSegments';
import { SectionHead } from '@/components/profile/SectionHead';
import { UserDataExport } from '@/components/profile/UserDataExport';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChromeBar } from '@/components/ui/ChromeBar';
import { DateField } from '@/components/ui/DateField';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MAJORS, majorLabel } from '@/src/data/majors';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { usePullRefresh } from '@/src/hooks/usePullRefresh';
import { useAuth } from '@/src/lib/auth';
import { loadBlocksForUser } from '@/src/lib/blocks';
import { localizedName } from '@/src/lib/format';
import { deleteUserAccount, setSuspended, unenrollUserMfa } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { isValidStudentId, sanitizeStudentId, splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import { sanitizeNationalId } from '@/src/lib/trust';
import { logAdminAction } from '@/src/lib/audit';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { OwnerStatus, PersonGender, Profile, UserRole } from '@/src/types/database';

type EditTab = 'profile' | 'access' | 'activity' | 'actions';

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export default function AdminUserEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile: me } = useAuth();
  const { cities, universities } = useCatalog();
  const [tab, setTab] = useState<EditTab>('profile');
  const [user, setUser] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
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
  const [nationalId, setNationalId] = useState('');
  const [nationalExpiresAt, setNationalExpiresAt] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRegion, setEmergencyRegion] = useState<PhoneRegion>('ps');
  const [emergencyLocal, setEmergencyLocal] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearingMfa, setClearingMfa] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'active' | 'suspended'>('active');
  const [suspendReason, setSuspendReason] = useState('');
  const [activity, setActivity] = useState<{
    bookings: { id: string; status: string; start_date: string }[];
    reports: number;
    blocks: Awaited<ReturnType<typeof loadBlocksForUser>>;
  }>({ bookings: [], reports: 0, blocks: [] });

  const applyUser = useCallback((next: Profile | null) => {
    setUser(next);
    setLoaded(true);
    if (!next) return;
    setFullName(namesFromProfile(next.full_name, next.full_name_en).ar);
    setFullNameEn(namesFromProfile(next.full_name, next.full_name_en).en);
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
    setNationalId(next.national_id_number ?? '');
    setNationalExpiresAt(next.national_id_expires_at ? next.national_id_expires_at.slice(0, 10) : '');
    setHomeAddress(next.home_address ?? '');
    setEmergencyName(next.emergency_name ?? '');
    const emergency = splitPhone(next.emergency_phone);
    setEmergencyRegion(emergency.region);
    setEmergencyLocal(emergency.local);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('profiles')
      .select('*, cities(*), universities(*)')
      .eq('id', id)
      .single();
    applyUser((data as Profile) ?? null);
    const [{ data: bookings }, reportsRes, blocks] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, status, start_date')
        .or(`student_id.eq.${id},owner_id.eq.${id}`)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('app_reports')
        .select('id', { count: 'exact', head: true })
        .or(`reporter_id.eq.${id},target_user_id.eq.${id}`),
      loadBlocksForUser(id).catch(() => []),
    ]);
    setActivity({
      bookings: (bookings as { id: string; status: string; start_date: string }[]) ?? [],
      reports: reportsRes.count ?? 0,
      blocks,
    });
  }, [id, applyUser]);

  const { refreshing, refresh } = usePullRefresh(load);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!isValidArabicName(fullName)) {
      alert(t('common.error'), t('auth.invalidNameAr'));
      return;
    }
    if (fullNameEn.trim() && !isValidEnglishName(fullNameEn)) {
      alert(t('common.error'), t('auth.invalidNameEn'));
      return;
    }
    const phone = phoneLocal.trim() ? toE164(phoneRegion, phoneLocal) : null;
    const whatsapp = whatsLocal.trim() ? toE164(whatsRegion, whatsLocal) : null;
    const emergencyPhone = emergencyLocal.trim() ? toE164(emergencyRegion, emergencyLocal) : null;
    if (phoneLocal.trim() && !phone) {
      alert(t('common.error'), t('phone.invalid'));
      return;
    }
    if (emergencyLocal.trim() && !emergencyPhone) {
      alert(t('common.error'), t('phone.invalid'));
      return;
    }
    if (studentId.trim() && !isValidStudentId(studentId)) {
      alert(t('common.error'), t('profile.studentIdHint'));
      return;
    }
    const nextRole = user.role === 'admin' ? 'admin' : role;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName(fullName),
          full_name_en: fullNameEn.trim() ? cleanName(fullNameEn) : null,
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
          national_id_number: sanitizeNationalId(nationalId) || null,
          national_id_expires_at: nationalExpiresAt || null,
          home_address: homeAddress.trim() || null,
          emergency_name: emergencyName.trim() || null,
          emergency_phone: emergencyPhone,
        })
        .eq('id', user.id);
      if (error) throw error;
      if (nextRole === 'owner' && ownerStatus === 'rejected') {
        await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', user.id);
      }
      void logAdminAction('user.update', { targetUserId: user.id });
      alert(t('common.done'), t('profile.saved'));
      await load();
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
              await setSuspended(user, next, next ? suspendReason : undefined);
              setSuspendReason('');
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

  const clearMfa = () => {
    if (!user || user.role === 'admin' || user.id === me?.id) return;
    alert(t('admin.disableMfa'), t('admin.confirmDisableMfa'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.disableMfa'),
        style: 'destructive',
        onPress: async () => {
          setClearingMfa(true);
          try {
            await unenrollUserMfa(user.id);
            alert(t('common.done'), t('admin.mfaDisabled'));
          } catch {
            alert(t('common.error'), t('admin.mfaDisableFailed'));
          } finally {
            setClearingMfa(false);
          }
        },
      },
    ]);
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

  const shownName =
    displayName({ full_name: fullName || user.full_name, full_name_en: user.full_name_en }, i18n.language) ||
    user.email;
  const canModerate = user.role !== 'admin' && user.id !== me?.id;
  const showStudies = role === 'student';
  const showIdReview =
    (user.role === 'student' || user.role === 'renter' || user.role === 'owner') &&
    Boolean(user.national_id_url || user.university_card_url);

  return (
    <Screen
      back
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      footer={
        tab === 'profile' || tab === 'access' ? (
          <Button title={t('common.save')} onPress={() => void save()} loading={saving} pill />
        ) : null
      }
    >
      <Card compact>
        <View style={[styles.header, row]}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.initials, { color: colors.primary }]}>{initials(shownName)}</Text>
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text style={[styles.name, rtlText, { color: colors.text }]} numberOfLines={1}>
              {shownName}
            </Text>
            <Text style={[styles.email, rtlText, { color: colors.textMuted }]} numberOfLines={1}>
              {user.email}
            </Text>
            <View style={[styles.badges, row]}>
              <StatusBadge label={t(`roles.${user.role}`)} tone="pending" />
              {accountStatus === 'suspended' ? (
                <StatusBadge label={t('admin.accountSuspended')} tone="rejected" />
              ) : user.role === 'owner' ? (
                <StatusBadge
                  label={
                    ownerStatus === 'approved'
                      ? t('admin.ownerActive')
                      : ownerStatus === 'rejected'
                        ? t('admin.ownerSuspended')
                        : t('admin.ownerWaiting')
                  }
                  tone={ownerStatus === 'approved' ? 'approved' : ownerStatus === 'rejected' ? 'rejected' : 'pending'}
                />
              ) : null}
            </View>
            {user.accepted_terms_at ? (
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
                {t('admin.acceptedTerms')}: {user.accepted_terms_at.slice(0, 10)}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      <ProfileSegments
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'profile', icon: 'person', label: t('admin.editTabProfile') },
          { key: 'access', icon: 'shield', label: t('admin.editTabAccess'), dot: showIdReview },
          { key: 'activity', icon: 'pulse-outline', label: t('admin.editTabActivity') },
          { key: 'actions', icon: 'hammer', label: t('admin.editTabActions') },
        ]}
      />

      {tab === 'profile' ? (
        <>
          <Card compact>
            <SectionHead compact icon="person-outline" title={t('profile.personalTitle')} />
            <NameField compact label={t('common.nameAr')} value={fullName} onChangeText={setFullName} script="ar" />
            <NameField compact label={t('common.nameEn')} value={fullNameEn} onChangeText={setFullNameEn} script="en" />
            <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.gender')}</Text>
            <FilterPills
              compact
              value={gender}
              onChange={setGender}
              allowDeselect
              items={[
                { value: 'male', label: t('profile.male') },
                { value: 'female', label: t('profile.female') },
              ]}
            />
            <DateField compact label={t('profile.birthDate')} value={birthDate} onChange={setBirthDate} />
            <Select
              dense
              label={t('common.city')}
              value={cityId}
              placeholder={t('common.select')}
              options={cityOptions}
              onChange={setCityId}
              clearable
            />
            <SearchSelect
              dense
              label={t('common.university')}
              value={universityId}
              placeholder={t('common.select')}
              options={universityOptions}
              onChange={setUniversityId}
              clearable
            />
          </Card>

          <Card compact>
            <SectionHead compact icon="call-outline" title={t('profile.contactTitle')} />
            <PhoneField
              compact
              label={t('common.phone')}
              region={phoneRegion}
              local={phoneLocal}
              onRegionChange={setPhoneRegion}
              onLocalChange={setPhoneLocal}
            />
            <PhoneField
              compact
              label={t('profile.whatsapp')}
              region={whatsRegion}
              local={whatsLocal}
              onRegionChange={setWhatsRegion}
              onLocalChange={setWhatsLocal}
            />
          </Card>

          <Card compact>
            <SectionHead compact icon="shield-checkmark-outline" title={t('profile.tabTrust')} />
            <Input
              compact
              label={t('profile.nationalId')}
              value={nationalId}
              onChangeText={(value) => setNationalId(sanitizeNationalId(value))}
              keyboardType="number-pad"
              ltr
            />
            <DateField
              compact
              label={t('profile.nationalIdExpiry')}
              value={nationalExpiresAt}
              onChange={setNationalExpiresAt}
              kind="expiry"
            />
            <Input
              compact
              label={t('profile.homeAddress')}
              value={homeAddress}
              onChangeText={setHomeAddress}
              multiline
            />
            <Input compact label={t('profile.emergencyName')} value={emergencyName} onChangeText={setEmergencyName} />
            <PhoneField
              compact
              label={t('profile.emergencyPhone')}
              region={emergencyRegion}
              local={emergencyLocal}
              onRegionChange={setEmergencyRegion}
              onLocalChange={setEmergencyLocal}
            />
          </Card>

          {showStudies ? (
            <Card compact>
              <SectionHead compact icon="school-outline" title={t('profile.studiesTitle')} />
              <Input
                compact
                label={t('profile.studentId')}
                value={studentId}
                onChangeText={(value) => setStudentId(sanitizeStudentId(value))}
                autoCapitalize="none"
                autoCorrect={false}
                ltr
              />
              <SearchSelect
                dense
                label={t('profile.major')}
                value={major}
                placeholder={t('profile.searchMajor')}
                options={majorOptions}
                onChange={setMajor}
                clearable
              />
              <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.degree')}</Text>
              <FilterPills
                compact
                value={degreeLevel}
                onChange={setDegreeLevel}
                allowDeselect
                items={[
                  { value: 'bachelor', label: t('profile.bachelor') },
                  { value: 'master', label: t('profile.master') },
                  { value: 'doctorate', label: t('profile.doctorate') },
                  { value: 'diploma', label: t('profile.diploma') },
                  { value: 'other', label: t('profile.otherDegree') },
                ]}
              />
              <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.studyYear')}</Text>
              <FilterPills
                compact
                value={studyYear}
                onChange={setStudyYear}
                allowDeselect
                items={(['1', '2', '3', '4', '5', '6'] as const).map((value) => ({
                  value,
                  label: t(`profile.year${value}`),
                }))}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'access' ? (
        <>
          {user.role !== 'admin' ? (
            <Card compact>
              <SectionHead compact icon="shield-outline" title={t('profile.role')} />
              <FilterPills
                compact
                value={role}
                onChange={setRole}
                items={[
                  { value: 'student', label: t('roles.student') },
                  { value: 'renter', label: t('roles.renter') },
                  { value: 'owner', label: t('roles.owner') },
                ]}
              />
              {role === 'owner' ? (
                <>
                  <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('admin.ownerStatus')}</Text>
                  <FilterPills
                    compact
                    value={ownerStatus}
                    onChange={setOwnerStatus}
                    items={[
                      { value: 'pending', label: t('admin.ownerWaiting') },
                      { value: 'approved', label: t('admin.ownerActive') },
                      { value: 'rejected', label: t('admin.ownerSuspended') },
                    ]}
                  />
                </>
              ) : null}
            </Card>
          ) : (
            <Card compact>
              <SectionHead compact icon="shield-outline" title={t('roles.admin')} />
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('roles.admin')}</Text>
            </Card>
          )}
          {showIdReview ? <IdReviewCard compact user={user} meId={me?.id} onChanged={() => void load()} /> : null}
        </>
      ) : null}

      {tab === 'activity' ? (
        <>
          <Card compact>
            <SectionHead compact icon="pulse-outline" title={t('admin.editTabActivity')} />
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
              {t('admin.activityBookings', { count: activity.bookings.length })}
            </Text>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
              {t('admin.activityReports', { count: activity.reports })}
            </Text>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
              {t('admin.activityBlocks', { count: activity.blocks.length })}
            </Text>
          </Card>
          {activity.bookings.length ? (
            <Card compact>
              <SectionHead compact icon="calendar-outline" title={t('tabs.bookings')} />
              {activity.bookings.map((item) => (
                <Text key={item.id} style={[styles.meta, rtlText, { color: colors.text }]}>
                  {item.start_date} · {t(`bookingStatus.${item.status}`)}
                </Text>
              ))}
            </Card>
          ) : null}
          {activity.blocks.length ? (
            <Card compact>
              <SectionHead compact icon="hand-left-outline" title={t('profile.blockedTitle')} />
              {activity.blocks.map((row) => {
                const other = row.blocker_id === user.id ? row.blocked : row.blocker;
                const name = other?.full_name || other?.email || row.blocked_id;
                return (
                  <Text key={`${row.blocker_id}-${row.blocked_id}`} style={[styles.meta, rtlText, { color: colors.text }]}>
                    {row.blocker_id === user.id
                      ? t('admin.blockedByUser', { name })
                      : t('admin.blockedUser', { name })}
                  </Text>
                );
              })}
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'actions' ? (
        <>
          <UserDataExport compact userId={user.id} titleKey="admin.exportUserData" />
          {canModerate ? (
            <Card compact>
              <SectionHead compact icon="warning-outline" title={t('admin.dangerZone')} />
              {accountStatus !== 'suspended' ? (
                <Input
                  compact
                  label={t('admin.suspendReason')}
                  value={suspendReason}
                  onChangeText={setSuspendReason}
                />
              ) : null}
              <View style={styles.actions}>
                <Button
                  title={t('admin.disableMfa')}
                  variant="secondary"
                  onPress={clearMfa}
                  loading={clearingMfa}
                  pill
                />
                <Button
                  title={accountStatus === 'suspended' ? t('admin.restoreAccount') : t('admin.suspend')}
                  variant={accountStatus === 'suspended' ? 'secondary' : 'danger'}
                  onPress={toggleSuspend}
                  pill
                />
                <Button title={t('admin.deleteUser')} variant="danger" onPress={removeUser} pill />
              </View>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 18 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 18, fontFamily: 'Cairo_800ExtraBold' },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 17, fontFamily: 'Cairo_800ExtraBold' },
  email: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  badges: { flexWrap: 'wrap', gap: 6, marginTop: 4 },
  meta: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginTop: 2 },
  label: { fontFamily: 'Cairo_700Bold', fontSize: 13 },
  muted: { textAlign: 'center' },
  actions: { gap: 8 },
});
