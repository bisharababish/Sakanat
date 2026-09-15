import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfileAccountFields } from '@/components/profile/ProfileAccountFields';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { ProfileSecurity } from '@/components/profile/ProfileSecurity';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useAdminPendingCounts } from '@/src/hooks/useAdminPendingCounts';
import { useHubTabBack } from '@/src/hooks/useHubTabBack';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { logAdminAction } from '@/src/lib/audit';
import { DEFAULT_COMMISSION_PERCENT } from '@/src/lib/commission';
import {
  exportListingsCsv,
  exportPlatformBookingsCsv,
  exportReportsCsv,
  exportReviewsCsv,
  exportUsersCsv,
} from '@/src/lib/dataExport';
import { ageLabel, localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { sameMobile, splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { pickProfilePhoto } from '@/src/lib/pickImage';
import { broadcastPush } from '@/src/lib/push';
import { loadBookingOpsStatus, runBookingOpsNow } from '@/src/lib/searchAlerts';
import { supabase } from '@/src/lib/supabase';
import { uploadProfilePhoto } from '@/src/lib/upload';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { PersonGender, Profile, UserRole } from '@/src/types/database';

type ProfileTab = 'menu' | 'account' | 'security' | 'settings';

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

function QueueRow({
  icon,
  label,
  count,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  count?: number;
  onPress: () => void;
}) {
  const { rtlText, row, isRtl } = useLayout();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.queueRow,
        row,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.queueIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={[styles.queueLabel, rtlText, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      {count != null && count > 0 ? (
        <View style={[styles.queueBadge, { backgroundColor: colors.warning }]}>
          <Text style={styles.queueBadgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
      <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export default function AdminSettings() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile } = useAuth();
  const { cities } = useCatalog();
  const today = useToday();
  const pending = useAdminPendingCounts();
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
  const [percent, setPercent] = useState(String(DEFAULT_COMMISSION_PERCENT));
  const [adminEmail, setAdminEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [opsRunning, setOpsRunning] = useState(false);
  const [opsStatus, setOpsStatus] = useState<{
    cronScheduled?: boolean;
    lastAt?: string | null;
    lastResult?: Record<string, number> | null;
  } | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastRoles, setBroadcastRoles] = useState<Array<'student' | 'renter' | 'owner'>>([
    'student',
    'renter',
    'owner',
  ]);
  const hydratedId = useRef<string | null>(null);
  const baseline = useRef<FormSnap | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (tabParam === 'account' || tabParam === 'security' || tabParam === 'settings') {
      setTab(tabParam);
    }
  }, [tabParam]);

  useFocusEffect(
    useCallback(() => {
      void pending.refresh();
      void loadBookingOpsStatus()
        .then(setOpsStatus)
        .catch(() => setOpsStatus(null));
    }, [pending.refresh]),
  );

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

  useEffect(() => {
    if (!profile) return;
    if (hydratedId.current === profile.id) return;
    hydratedId.current = profile.id;
    applyForm(profile);
  }, [profile, applyForm]);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('commission_percent, admin_email')
      .eq('id', 1)
      .maybeSingle();
    if (data?.commission_percent != null) setPercent(String(data.commission_percent));
    if (data?.admin_email) setAdminEmail(String(data.admin_email));
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
      alert(t('common.error'), t('profile.completeRequiredOwner'));
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

  const saveCommission = async () => {
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      alert(t('common.error'), t('admin.invalidCommission'));
      return;
    }
    const email = adminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      alert(t('common.error'), t('auth.invalidEmail'));
      return;
    }
    setSavingCommission(true);
    const { error } = await supabase
      .from('app_settings')
      .update({
        commission_percent: value,
        admin_email: email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSavingCommission(false);
    if (error) alert(t('common.error'), error.message);
    else {
      setPercent(String(value));
      setAdminEmail(email);
      void logAdminAction('settings.update', { detail: { commission_percent: value, admin_email: email } });
      alert(t('common.done'));
    }
  };

  const runOps = async () => {
    setOpsRunning(true);
    try {
      const result = await runBookingOpsNow();
      void logAdminAction('ops.booking_run', { detail: result });
      const status = await loadBookingOpsStatus().catch(() => null);
      setOpsStatus(status);
      alert(
        t('common.done'),
        t('admin.opsDone', {
          reminded: result.reminded ?? 0,
          expired: result.expired ?? 0,
          completed: result.completed ?? 0,
          nudged: result.nudged ?? 0,
        }),
      );
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('admin.opsFailed'));
    } finally {
      setOpsRunning(false);
    }
  };

  const runExport = async (
    kind: 'bookings' | 'users' | 'listings' | 'reports' | 'reviews',
  ) => {
    setExporting(true);
    try {
      const count =
        kind === 'users'
          ? await exportUsersCsv()
          : kind === 'listings'
            ? await exportListingsCsv()
            : kind === 'reports'
              ? await exportReportsCsv()
              : kind === 'reviews'
                ? await exportReviewsCsv()
                : await exportPlatformBookingsCsv();
      void logAdminAction('export.platform', { detail: { kind, rows: count } });
      alert(t('common.done'), t('admin.exportDone', { count }));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setExporting(false);
    }
  };

  const sendBroadcast = async () => {
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title || body.length < 8) {
      alert(t('common.error'), t('admin.broadcastShort'));
      return;
    }
    if (broadcastRoles.length === 0) {
      alert(t('common.error'), t('admin.broadcastNeedRoles'));
      return;
    }
    alert(t('admin.broadcastTitle'), t('admin.broadcastConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.broadcastSend'),
        onPress: async () => {
          setBroadcasting(true);
          try {
            const result = await broadcastPush({ roles: broadcastRoles, title, body });
            void logAdminAction('broadcast', {
              note: title,
              detail: { roles: broadcastRoles, recipients: result.recipients },
            });
            setBroadcastTitle('');
            setBroadcastBody('');
            alert(t('common.done'), t('admin.broadcastSent', { count: result.recipients }));
          } catch (err) {
            alert(t('common.error'), err instanceof Error ? err.message : '');
          } finally {
            setBroadcasting(false);
          }
        },
      },
    ]);
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
            onPress: () => setTab('settings'),
          }
        : {
            icon: 'cash-outline' as const,
            text: `${t('admin.commissionRate')}: ${percent}%`,
            onPress: () => setTab('settings'),
          };

  return (
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
            metas={[
              { icon: 'shield-checkmark', text: t('admin.platformSettings') },
              ...(ageLabel(birthDate, t, today)
                ? [{ icon: 'hourglass-outline' as const, text: ageLabel(birthDate, t, today) }]
                : []),
              ...(cityName ? [{ icon: 'location' as const, text: cityName }] : []),
            ]}
            chip={t('roles.admin')}
            email={profile?.email}
          />
          <ProfileBanner icon={banner.icon} text={banner.text} onPress={banner.onPress} />
          <ProfileProgress
            items={progressItems}
            onJump={() => setTab('account')}
            readyLabel={t('admin.profileReady')}
          />
          <ProfileMenu
            links={[
              {
                key: 'account',
                icon: 'person-outline',
                label: t('profile.personalTitle'),
                dot: incomplete,
                onPress: () => setTab('account'),
              },
              {
                key: 'settings',
                icon: 'options-outline',
                label: t('profile.tabSettings'),
                hint: pendingTotal > 0 ? String(pendingTotal) : undefined,
                dot: pendingTotal > 0,
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
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>
          {tab === 'account'
            ? t('profile.personalTitle')
            : tab === 'security'
              ? t('profile.tabSecurity')
              : t('profile.tabSettings')}
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

      {tab === 'settings' ? (
        <>
          <Card compact>
            <SectionHead compact icon="flash-outline" title={t('admin.queueTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.queueHint')}</Text>
            <View style={styles.queueList}>
              <QueueRow
                icon="people-outline"
                label={t('admin.pendingOwners')}
                count={pending.owners}
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/(tabs)/users',
                    params: { role: 'owner', owner: 'pending', from: 'settings' },
                  })
                }
              />
              <QueueRow
                icon="id-card-outline"
                label={t('admin.pendingIds')}
                count={pending.ids}
                onPress={() => router.push('/(admin)/verify')}
              />
              <QueueRow
                icon="home-outline"
                label={t('admin.pendingListings')}
                count={pending.listings}
                onPress={() =>
                  router.push({ pathname: '/(admin)/(tabs)/listings', params: { from: 'settings' } })
                }
              />
              <QueueRow
                icon="calendar-outline"
                label={t('admin.pendingBookings')}
                count={pending.bookings}
                onPress={() =>
                  router.push({ pathname: '/(admin)/(tabs)/bookings', params: { from: 'settings' } })
                }
              />
              <QueueRow
                icon="flag-outline"
                label={t('admin.reportsTitle')}
                count={pending.reports}
                onPress={() => router.push('/(admin)/reports')}
              />
              <QueueRow
                icon="star-outline"
                label={t('admin.reviewsTitle')}
                onPress={() => router.push('/(admin)/reviews')}
              />
              <QueueRow
                icon="wallet-outline"
                label={t('admin.payoutsTitle')}
                onPress={() => router.push('/(admin)/payouts')}
              />
              <QueueRow
                icon="map-outline"
                label={t('admin.catalogTitle')}
                onPress={() => router.push('/(admin)/catalog')}
              />
              <QueueRow
                icon="time-outline"
                label={t('admin.auditTitle')}
                onPress={() => router.push('/(admin)/audit')}
              />
            </View>
          </Card>

          <Card compact>
            <SectionHead compact icon="cash-outline" title={t('admin.platformSettings')} />
            <Input
              compact
              label={`${t('admin.commissionRate')} %`}
              value={percent}
              onChangeText={setPercent}
              keyboardType="numeric"
            />
            <Input
              compact
              label={t('admin.adminEmail')}
              value={adminEmail}
              onChangeText={setAdminEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              ltr
              hint={t('admin.adminEmailHint')}
            />
            <Button
              title={t('admin.saveSettings')}
              onPress={() => void saveCommission()}
              loading={savingCommission}
              pill
            />
          </Card>

          <Card compact>
            <SectionHead compact icon="timer-outline" title={t('admin.opsTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.opsHint')}</Text>
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
              {t('admin.opsCron', {
                status: opsStatus?.cronScheduled ? t('admin.opsCronOn') : t('admin.opsCronOff'),
              })}
            </Text>
            {opsStatus?.lastAt ? (
              <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
                {t('admin.opsLast', {
                  at: new Date(opsStatus.lastAt).toLocaleString(i18n.language.startsWith('ar') ? 'ar' : 'en'),
                })}
              </Text>
            ) : null}
            <Button
              title={t('admin.opsRun')}
              pill
              loading={opsRunning}
              onPress={() => void runOps()}
            />
          </Card>

          <Card compact>
            <SectionHead compact icon="storefront-outline" title={t('admin.storeReadyTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.storeReadyHint')}</Text>
            {[
              t('admin.storeReadyPrivacy'),
              t('admin.storeReadyDelete'),
              t('admin.storeReadySupport'),
              t('admin.storeReadyShots'),
              t('admin.storeReadyPayments'),
            ].map((line) => (
              <View key={line} style={[styles.queueRow, row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.queueIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.queueLabel, rtlText, { color: colors.text }]}>{line}</Text>
              </View>
            ))}
          </Card>

          <Card compact>
            <SectionHead compact icon="download-outline" title={t('admin.exportTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.exportHint')}</Text>
            <Button
              title={t('admin.exportBookingsCsv')}
              variant="secondary"
              pill
              loading={exporting}
              onPress={() => void runExport('bookings')}
            />
            <Button
              title={t('admin.exportUsersCsv')}
              variant="secondary"
              pill
              loading={exporting}
              onPress={() => void runExport('users')}
            />
            <Button
              title={t('admin.exportListingsCsv')}
              variant="secondary"
              pill
              loading={exporting}
              onPress={() => void runExport('listings')}
            />
            <Button
              title={t('admin.exportReportsCsv')}
              variant="secondary"
              pill
              loading={exporting}
              onPress={() => void runExport('reports')}
            />
            <Button
              title={t('admin.exportReviewsCsv')}
              variant="secondary"
              pill
              loading={exporting}
              onPress={() => void runExport('reviews')}
            />
          </Card>

          <Card compact>
            <SectionHead compact icon="megaphone-outline" title={t('admin.broadcastTitle')} />
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('admin.broadcastHint')}</Text>
            <FilterPills
              compact
              values={broadcastRoles}
              onToggle={(role) =>
                setBroadcastRoles((current) =>
                  current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
                )
              }
              items={[
                { value: 'student', label: t('roles.student') },
                { value: 'renter', label: t('roles.renter') },
                { value: 'owner', label: t('roles.owner') },
              ]}
            />
            <Input compact label={t('admin.broadcastSubject')} value={broadcastTitle} onChangeText={setBroadcastTitle} />
            <Input
              compact
              label={t('admin.broadcastBody')}
              value={broadcastBody}
              onChangeText={setBroadcastBody}
              multiline
            />
            <Button title={t('admin.broadcastSend')} pill loading={broadcasting} onPress={() => void sendBroadcast()} />
          </Card>
        </>
      ) : null}
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 19 },
  queueList: { gap: spacing.xs },
  queueRow: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  queueIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueLabel: { flex: 1, fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  queueBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Cairo_700Bold' },
});
