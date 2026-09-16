import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListingCard } from '@/components/ListingCard';
import { EmptyState } from '@/components/EmptyState';
import { OwnerSeenCard } from '@/components/profile/OwnerSeenCard';
import { ProfileAccountFields } from '@/components/profile/ProfileAccountFields';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { ProfileEnter } from '@/components/profile/ProfileEnter';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { ProfileSafetyFields } from '@/components/profile/ProfileSafetyFields';
import { ProfileSettingsFields } from '@/components/profile/ProfileSettingsFields';
import { SectionHead } from '@/components/profile/SectionHead';
import { ProfileSecurity } from '@/components/profile/ProfileSecurity';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { MAJORS, majorLabel } from '@/src/data/majors';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useHubTabBack } from '@/src/hooks/useHubTabBack';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useLiveReload } from '@/src/hooks/useLiveReload';
import { useToday } from '@/src/hooks/useToday';
import { useAuth } from '@/src/lib/auth';
import { deleteOwnAccount } from '@/src/lib/moderation';
import { listingDistanceKm } from '@/src/lib/distance';
import { LISTING_PAGE_SIZE } from '@/src/lib/page';
import { verifiedTotpFactor } from '@/src/lib/mfa';
import { ageLabel, localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { cleanName, displayName, isValidArabicName, isValidEnglishName, namesFromProfile } from '@/src/lib/name';
import { formatEmailDomains, studentEmailError } from '@/src/lib/eduEmail';
import { regionPrefix, sameMobile, sanitizeStudentId, isValidStudentId, splitPhone, toE164 } from '@/src/lib/phone';
import type { PhoneRegion } from '@/src/lib/phone';
import { canShowSeekerContact, shouldShareEmergency, shouldShowLastSeen, shouldShowSavedCount } from '@/src/lib/privacy';
import { loadPendingReview } from '@/src/lib/reviews';
import { loadSavedApartments, toggleSavedApartment } from '@/src/lib/saved';
import { pickIdCardPhoto, pickProfilePhoto } from '@/src/lib/pickImage';
import { SUPPORT_EMAIL } from '@/src/lib/support';
import { supabase } from '@/src/lib/supabase';
import { isValidNationalId, sanitizeNationalId, isValidBio, isValidEmergencyName, isValidHomeAddress, isValidNationalIdExpiry, nationalIdExpiryState } from '@/src/lib/trust';
import { idDocUrl, uploadIdDoc, uploadProfilePhoto } from '@/src/lib/upload';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { Apartment, PersonGender, Profile } from '@/src/types/database';

type ProfileTab = 'menu' | 'account' | 'trust' | 'settings' | 'saved' | 'security';

type SectionKey = 'hero' | 'names' | 'about' | 'contact' | 'studies' | 'docs' | 'emergency';

function cleanStudentId(raw: string) {
  return sanitizeStudentId(String(raw ?? ''));
}

function englishNameOk(raw: string) {
  if (typeof isValidEnglishName === 'function') return isValidEnglishName(raw);
  const words = String(raw ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 4;
}

function arabicNameOk(raw: string) {
  if (typeof isValidArabicName === 'function') return isValidArabicName(raw);
  const words = String(raw ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 4;
}

async function fetchPublicIp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timer);
    const json = (await response.json()) as { ip?: string };
    const ip = json.ip?.trim() ?? '';
    return ip.length > 6 && ip.length < 64 ? ip : null;
  } catch {
    return null;
  }
}
type FormSnap = {
  fullNameEn: string;
  fullNameAr: string;
  phoneRegion: PhoneRegion;
  phoneLocal: string;
  studentId: string;
  waRegion: PhoneRegion;
  waLocal: string;
  waLinked: boolean;
  major: string;
  degreeLevel: string;
  studyYear: string;
  gender: PersonGender | '';
  birthDate: string;
  cityId: string;
  universityId: string;
  avatarUrl: string | null;
  homeAddress: string;
  bio: string;
  spokenLanguages: string[];
  graduationTerm: string;
  nationalId: string;
  nationalExpiresAt: string;
  idDocsConsent: boolean;
  nationalIdUrl: string | null;
  universityCardUrl: string | null;
  emergencyName: string;
  emergencyRegion: PhoneRegion;
  emergencyLocal: string;
};

function snapsEqual(a: FormSnap | null, b: FormSnap | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.fullNameEn === b.fullNameEn &&
    a.fullNameAr === b.fullNameAr &&
    a.phoneRegion === b.phoneRegion &&
    a.phoneLocal === b.phoneLocal &&
    a.studentId === b.studentId &&
    a.waLinked === b.waLinked &&
    a.waRegion === b.waRegion &&
    a.waLocal === b.waLocal &&
    a.major === b.major &&
    a.degreeLevel === b.degreeLevel &&
    a.studyYear === b.studyYear &&
    a.gender === b.gender &&
    a.birthDate === b.birthDate &&
    a.cityId === b.cityId &&
    a.universityId === b.universityId &&
    a.avatarUrl === b.avatarUrl &&
    a.homeAddress === b.homeAddress &&
    a.bio === b.bio &&
    a.spokenLanguages.join(',') === b.spokenLanguages.join(',') &&
    a.graduationTerm === b.graduationTerm &&
    a.nationalId === b.nationalId &&
    a.nationalExpiresAt === b.nationalExpiresAt &&
    a.idDocsConsent === b.idDocsConsent &&
    a.nationalIdUrl === b.nationalIdUrl &&
    a.universityCardUrl === b.universityCardUrl &&
    a.emergencyName === b.emergencyName &&
    a.emergencyRegion === b.emergencyRegion &&
    a.emergencyLocal === b.emergencyLocal
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
    studentId: next.student_id_number ?? '',
    waLinked: sameNumber,
    waRegion: sameNumber ? phoneParts.region : waParts.region,
    waLocal: sameNumber ? phoneParts.local : waParts.local,
    major: next.major ?? '',
    degreeLevel:
      next.degree_level ?? (next.study_year === 'graduate' ? 'master' : next.study_year ? 'bachelor' : ''),
    studyYear: next.study_year && next.study_year !== 'graduate' ? next.study_year : '',
    gender: next.gender ?? '',
    birthDate: next.date_of_birth ? next.date_of_birth.slice(0, 10) : '',
    cityId: next.city_id ?? '',
    universityId: next.university_id ?? '',
    avatarUrl: next.avatar_url ?? null,
    homeAddress: next.home_address ?? '',
    bio: next.bio ?? '',
    spokenLanguages: next.spoken_languages ?? [],
    graduationTerm: next.graduation_term ?? '',
    nationalId: next.national_id_number ?? '',
    nationalExpiresAt: next.national_id_expires_at ? next.national_id_expires_at.slice(0, 10) : '',
    idDocsConsent: Boolean(next.id_docs_consent_at),
    nationalIdUrl: next.national_id_url ?? null,
    universityCardUrl: next.university_card_url ?? null,
    emergencyName: next.emergency_name ?? '',
    emergencyRegion: splitPhone(next.emergency_phone).region,
    emergencyLocal: splitPhone(next.emergency_phone).local,
  };
}

function applySnap(
  snap: FormSnap,
  set: {
    fullNameEn: (v: string) => void;
    fullNameAr: (v: string) => void;
    phoneRegion: (v: PhoneRegion) => void;
    phoneLocal: (v: string) => void;
    studentId: (v: string) => void;
    waLinked: (v: boolean) => void;
    waRegion: (v: PhoneRegion) => void;
    waLocal: (v: string) => void;
    major: (v: string) => void;
    degreeLevel: (v: string) => void;
    studyYear: (v: string) => void;
    gender: (v: PersonGender | '') => void;
    birthDate: (v: string) => void;
    cityId: (v: string) => void;
    universityId: (v: string) => void;
    avatarUrl: (v: string | null) => void;
    homeAddress: (v: string) => void;
    bio: (v: string) => void;
    spokenLanguages: (v: string[]) => void;
    graduationTerm: (v: string) => void;
    nationalId: (v: string) => void;
    nationalExpiresAt: (v: string) => void;
    idDocsConsent: (v: boolean) => void;
    nationalIdUrl: (v: string | null) => void;
    universityCardUrl: (v: string | null) => void;
    emergencyName: (v: string) => void;
    emergencyRegion: (v: PhoneRegion) => void;
    emergencyLocal: (v: string) => void;
  },
) {
  set.fullNameEn(snap.fullNameEn);
  set.fullNameAr(snap.fullNameAr);
  set.phoneRegion(snap.phoneRegion);
  set.phoneLocal(snap.phoneLocal);
  set.studentId(snap.studentId);
  set.waLinked(snap.waLinked);
  set.waRegion(snap.waRegion);
  set.waLocal(snap.waLocal);
  set.major(snap.major);
  set.degreeLevel(snap.degreeLevel);
  set.studyYear(snap.studyYear);
  set.gender(snap.gender);
  set.birthDate(snap.birthDate);
  set.cityId(snap.cityId);
  set.universityId(snap.universityId);
  set.avatarUrl(snap.avatarUrl);
  set.homeAddress(snap.homeAddress);
  set.bio(snap.bio);
  set.spokenLanguages(snap.spokenLanguages);
  set.graduationTerm(snap.graduationTerm);
  set.nationalId(snap.nationalId);
  set.nationalExpiresAt(snap.nationalExpiresAt);
  set.idDocsConsent(snap.idDocsConsent);
  set.nationalIdUrl(snap.nationalIdUrl);
  set.universityCardUrl(snap.universityCardUrl);
  set.emergencyName(snap.emergencyName);
  set.emergencyRegion(snap.emergencyRegion);
  set.emergencyLocal(snap.emergencyLocal);
}

function degreeName(value: string, t: (key: string) => string) {
  if (value === 'bachelor') return t('profile.bachelor');
  if (value === 'master') return t('profile.master');
  if (value === 'doctorate') return t('profile.doctorate');
  if (value === 'diploma') return t('profile.diploma');
  if (value === 'other') return t('profile.otherDegree');
  return '';
}

export default function StudentProfileScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile, signOut } = useAuth();
  const { resumeBook, tab: tabParam } = useLocalSearchParams<{
    resumeBook?: string;
    tab?: string;
  }>();
  const resumeId = typeof resumeBook === 'string' ? resumeBook : undefined;
  const { cities, universities } = useCatalog();
  const today = useToday();
  const [tab, setTab] = useState<ProfileTab>('menu');
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
  const [homeAddress, setHomeAddress] = useState('');
  const [bio, setBio] = useState('');
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>([]);
  const [graduationTerm, setGraduationTerm] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [nationalExpiresAt, setNationalExpiresAt] = useState('');
  const [idDocsConsent, setIdDocsConsent] = useState(false);
  const [nationalIdUrl, setNationalIdUrl] = useState<string | null>(null);
  const [universityCardUrl, setUniversityCardUrl] = useState<string | null>(null);
  const [nationalPreview, setNationalPreview] = useState<string | null>(null);
  const [universityPreview, setUniversityPreview] = useState<string | null>(null);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRegion, setEmergencyRegion] = useState<PhoneRegion>('ps');
  const [emergencyLocal, setEmergencyLocal] = useState('');
  const [savedListings, setSavedListings] = useState<Apartment[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mfaOn, setMfaOn] = useState(true);
  const [needsReview, setNeedsReview] = useState(false);
  const [waLinked, setWaLinked] = useState(true);
  const hydratedId = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const baseline = useRef<FormSnap | null>(null);
  const dirtyRef = useRef(false);

  const applyForm = useCallback((next: Profile) => {
    const snap = snapFromProfile(next);
    applySnap(snap, {
      fullNameEn: setFullNameEn,
      fullNameAr: setFullNameAr,
      phoneRegion: setPhoneRegion,
      phoneLocal: setPhoneLocal,
      studentId: setStudentId,
      waLinked: setWaLinked,
      waRegion: setWaRegion,
      waLocal: setWaLocal,
      major: setMajor,
      degreeLevel: setDegreeLevel,
      studyYear: setStudyYear,
      gender: setGender,
      birthDate: setBirthDate,
      cityId: setCityId,
      universityId: setUniversityId,
      avatarUrl: setAvatarUrl,
      homeAddress: setHomeAddress,
      bio: setBio,
      spokenLanguages: setSpokenLanguages,
      graduationTerm: setGraduationTerm,
      nationalId: setNationalId,
      nationalExpiresAt: setNationalExpiresAt,
      idDocsConsent: setIdDocsConsent,
      nationalIdUrl: setNationalIdUrl,
      universityCardUrl: setUniversityCardUrl,
      emergencyName: setEmergencyName,
      emergencyRegion: setEmergencyRegion,
      emergencyLocal: setEmergencyLocal,
    });
    baseline.current = snap;
  }, []);

  const goHub = useCallback(() => {
    if (baseline.current) {
      applySnap(baseline.current, {
        fullNameEn: setFullNameEn,
        fullNameAr: setFullNameAr,
        phoneRegion: setPhoneRegion,
        phoneLocal: setPhoneLocal,
        studentId: setStudentId,
        waLinked: setWaLinked,
        waRegion: setWaRegion,
        waLocal: setWaLocal,
        major: setMajor,
        degreeLevel: setDegreeLevel,
        studyYear: setStudyYear,
        gender: setGender,
        birthDate: setBirthDate,
        cityId: setCityId,
        universityId: setUniversityId,
        avatarUrl: setAvatarUrl,
        homeAddress: setHomeAddress,
        bio: setBio,
        spokenLanguages: setSpokenLanguages,
        graduationTerm: setGraduationTerm,
        nationalId: setNationalId,
        nationalExpiresAt: setNationalExpiresAt,
        idDocsConsent: setIdDocsConsent,
        nationalIdUrl: setNationalIdUrl,
        universityCardUrl: setUniversityCardUrl,
        emergencyName: setEmergencyName,
        emergencyRegion: setEmergencyRegion,
        emergencyLocal: setEmergencyLocal,
      });
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

  useEffect(() => {
    if (
      tabParam === 'saved' ||
      tabParam === 'security' ||
      tabParam === 'account' ||
      tabParam === 'trust' ||
      tabParam === 'settings'
    ) {
      setTab(tabParam);
      return;
    }
    if (resumeId) setTab('account');
  }, [resumeId, tabParam]);

  useEffect(() => {
    let active = true;
    void Promise.all([idDocUrl(nationalIdUrl), idDocUrl(universityCardUrl)]).then(([national, university]) => {
      if (!active) return;
      setNationalPreview(national);
      setUniversityPreview(university);
    });
    return () => {
      active = false;
    };
  }, [nationalIdUrl, universityCardUrl]);

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        value: city.id,
        label: localizedName(city, i18n.language),
        lat: city.lat,
        lng: city.lng,
      })),
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
  const degreeLabelText = degreeName(degreeLevel, t);
  const isStudent = profile?.role !== 'renter';
  const currentSnap: FormSnap = {
    fullNameEn,
    fullNameAr,
    phoneRegion,
    phoneLocal,
    studentId,
    waLinked,
    waRegion,
    waLocal,
    major,
    degreeLevel,
    studyYear,
    gender,
    birthDate,
    cityId,
    universityId,
    avatarUrl,
    homeAddress,
    bio,
    spokenLanguages,
    graduationTerm,
    nationalId,
    nationalExpiresAt,
    idDocsConsent,
    nationalIdUrl,
    universityCardUrl,
    emergencyName,
    emergencyRegion,
    emergencyLocal,
  };
  const cleanWhatsappNow =
    typeof toE164 === 'function' ? toE164(waRegion, waLocal) : null;
  const cleanPhoneNow =
    typeof toE164 === 'function' ? toE164(phoneRegion, phoneLocal) : null;
  const cleanEmergency =
    typeof toE164 === 'function' ? toE164(emergencyRegion, emergencyLocal) : null;
  const dirty = baseline.current != null && !snapsEqual(currentSnap, baseline.current);
  dirtyRef.current = dirty;
  // Keep these checks inline — named imports from trust/phone were crashing as undefined under Metro HMR.
  const progressItems = [
    { id: 'photo', label: t('profile.photo'), done: Boolean(avatarUrl) },
    { id: 'nameEn', label: t('common.nameEn'), done: englishNameOk(fullNameEn) },
    { id: 'nameAr', label: t('common.nameAr'), done: arabicNameOk(fullNameAr) },
    { id: 'gender', label: t('profile.gender'), done: Boolean(gender) },
    { id: 'city', label: t('auth.homeCity'), done: Boolean(cityId) },
    { id: 'homeAddress', label: t('profile.homeAddress'), done: isValidHomeAddress(homeAddress) },
    { id: 'birth', label: t('profile.birthDate'), done: Boolean(birthDate) },
    { id: 'phone', label: t('common.phone'), done: Boolean(cleanPhoneNow) },
    { id: 'whatsapp', label: t('profile.whatsapp'), done: Boolean(cleanWhatsappNow) },
    { id: 'nationalId', label: t('profile.nationalId'), done: isValidNationalId(nationalId) },
    {
      id: 'nationalExpiry',
      label: t('profile.nationalIdExpiry'),
      done: isValidNationalIdExpiry(nationalExpiresAt),
    },
    { id: 'nationalCard', label: t('profile.nationalCard'), done: Boolean(nationalIdUrl) && idDocsConsent },
    { id: 'emergencyName', label: t('profile.emergencyName'), done: isValidEmergencyName(emergencyName) },
    {
      id: 'emergencyPhone',
      label: t('profile.emergencyPhone'),
      done: Boolean(cleanEmergency) && cleanEmergency !== cleanPhoneNow,
    },
    ...(isStudent
      ? [
          { id: 'university', label: t('auth.studyUniversity'), done: Boolean(universityId) },
          { id: 'studentId', label: t('profile.studentId'), done: isValidStudentId(studentId) },
          { id: 'major', label: t('profile.major'), done: Boolean(major) },
          { id: 'degree', label: t('profile.degree'), done: Boolean(degreeLevel) },
          { id: 'year', label: t('profile.studyYear'), done: Boolean(studyYear) },
          { id: 'universityCard', label: t('profile.universityCard'), done: Boolean(universityCardUrl) },
        ]
      : []),
  ];
  const incomplete = progressItems.some((item) => !item.done);
  const trustIds = new Set([
    'nationalId',
    'nationalExpiry',
    'nationalCard',
    'universityCard',
    'emergencyName',
    'emergencyPhone',
  ]);
  const trustIncomplete = progressItems.some(
    (item) => item.id && (trustIds.has(item.id) || item.id === 'homeAddress') && !item.done,
  );
  const accountIncomplete = progressItems.some((item) => item.id && !trustIds.has(item.id) && !item.done);
  const jumpTo = (id: string) => {
    const section: SectionKey =
      id === 'photo'
        ? 'hero'
        : id === 'nameEn' || id === 'nameAr'
          ? 'names'
          : id === 'gender' || id === 'city' || id === 'birth' || id === 'homeAddress'
            ? 'about'
            : id === 'phone' || id === 'whatsapp'
              ? 'contact'
              : id === 'nationalId' || id === 'nationalExpiry' || id === 'nationalCard' || id === 'universityCard'
                ? 'docs'
                : id === 'emergencyName' || id === 'emergencyPhone'
                  ? 'emergency'
                  : 'studies';
    const nextTab: ProfileTab =
      section === 'docs' || section === 'emergency' ? 'trust' : 'account';
    const go = () => {
      const y = sectionY.current[section] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    };
    if (tab !== nextTab) {
      setTab(nextTab);
      setTimeout(go, 80);
      return;
    }
    go();
  };
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
    await Promise.all([
      reloadSaved(),
      refreshProfile(),
      profile?.id
        ? loadPendingReview(profile.id)
            .then((pending) => setNeedsReview(Boolean(pending)))
            .catch(() => setNeedsReview(false))
        : Promise.resolve(),
    ]);
  }, [reloadSaved, refreshProfile, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    void verifiedTotpFactor()
      .then((factor) => {
        if (alive) setMfaOn(Boolean(factor));
      })
      .catch(() => {
        if (alive) setMfaOn(false);
      });
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  const reloadPull = useCallback(async () => {
    const [, next] = await Promise.all([reloadSaved(), refreshProfile()]);
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
  }, [reloadSaved, refreshProfile, applyForm, t]);

  const { refreshing, refresh } = useLiveReload(
    reloadAll,
    ['saved_apartments', 'apartments', 'profiles', 'apartment_reviews'],
    `saved:${profile?.id ?? ''}`,
    reloadPull,
  );

  const uploadCard = async (kind: 'national' | 'university') => {
    if (!profile) return;
    if (!idDocsConsent) {
      alert(t('common.error'), t('profile.idConsentRequired'));
      return;
    }
    const uri = await pickIdCardPhoto();
    if (!uri) return;
    setUploadingDoc(true);
    if (kind === 'national') setNationalIdUrl(uri);
    else setUniversityCardUrl(uri);
    try {
      const path = await uploadIdDoc(profile.id, kind, uri);
      const column = kind === 'national' ? 'national_id_url' : 'university_card_url';
      const { error } = await supabase
        .from('profiles')
        .update({
          [column]: path,
          id_verify_status: 'pending',
          id_docs_consent_at: profile.id_docs_consent_at ?? new Date().toISOString(),
        })
        .eq('id', profile.id);
      if (error) {
        if (/national_id_url|university_card_url|id_verify_status|column/i.test(error.message)) {
          throw new Error(t('profile.idUploadFailed'));
        }
        throw error;
      }
      if (!profile.id_docs_consent_at) setIdDocsConsent(true);
      if (kind === 'national') setNationalIdUrl(path);
      else setUniversityCardUrl(path);
      await refreshProfile();
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : t('profile.idUploadFailed'));
    } finally {
      setUploadingDoc(false);
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
    if (!profile) return;
    const onTrust = tab === 'trust';
    const missing = progressItems
      .filter((item) => {
        if (item.done || !item.id) return false;
        const trustField = trustIds.has(item.id);
        return onTrust ? trustField : !trustField;
      })
      .map((item) => item.label);
    if (missing.length > 0) {
      alert(t('profile.stillNeeded'), missing.join('\n') || t(isStudent ? 'profile.completeRequired' : 'profile.completeRequiredRenter'));
      return;
    }
    const cleanPhone = toE164(phoneRegion, phoneLocal);
    const cleanWhatsapp = toE164(waRegion, waLocal);
    const cleanEmergency = toE164(emergencyRegion, emergencyLocal);
    if (!onTrust) {
      if (!cleanPhone) {
        alert(t('common.error'), t('phone.invalid'));
        return;
      }
      if (!cleanWhatsapp) {
        alert(t('common.error'), t('phone.invalid'));
        return;
      }
      if (isStudent && !isValidStudentId(studentId)) {
        alert(t('common.error'), t('profile.studentIdHint'));
        return;
      }
      if (!isValidHomeAddress(homeAddress)) {
        alert(t('common.error'), t('profile.homeAddressInvalid'));
        return;
      }
      if (!isValidBio(bio)) {
        alert(t('common.error'), t('profile.bioInvalid'));
        return;
      }
      if (!englishNameOk(fullNameEn)) {
        alert(t('common.error'), t('auth.invalidNameEn'));
        return;
      }
      if (!arabicNameOk(fullNameAr)) {
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
    } else {
      if (!cleanEmergency || cleanEmergency === (cleanPhone || profile.phone)) {
        alert(t('common.error'), t('profile.emergencySamePhone'));
        return;
      }
      if (nationalId.trim() && !isValidNationalId(nationalId)) {
        alert(t('common.error'), t('profile.nationalIdInvalid'));
        return;
      }
      if (!isValidNationalIdExpiry(nationalExpiresAt)) {
        alert(
          t('common.error'),
          nationalIdExpiryState(nationalExpiresAt) === 'expired'
            ? t('profile.idExpired')
            : t('profile.idExpiryInvalid'),
        );
        return;
      }
      if (!isValidEmergencyName(emergencyName)) {
        alert(t('common.error'), t('profile.emergencyNameInvalid'));
        return;
      }
      if ((nationalIdUrl || universityCardUrl) && !idDocsConsent) {
        alert(t('common.error'), t('profile.idConsentRequired'));
        return;
      }
    }
    const ip = await fetchPublicIp();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName(fullNameAr) || profile.full_name,
          full_name_en: englishNameOk(fullNameEn) ? cleanName(fullNameEn) : (profile.full_name_en ?? null),
          phone: cleanPhone || profile.phone,
          student_id_number: isStudent ? studentId.trim() || null : null,
          whatsapp: cleanWhatsapp || profile.whatsapp,
          major: isStudent ? major || null : null,
          degree_level: isStudent ? degreeLevel || null : null,
          study_year: isStudent ? studyYear || null : null,
          gender: gender || null,
          date_of_birth: birthDate || null,
          city_id: cityId || null,
          university_id: isStudent ? universityId || null : null,
          home_address: homeAddress.trim() || profile.home_address,
          bio: bio.trim() || null,
          spoken_languages: spokenLanguages,
          graduation_term: graduationTerm.trim() || null,
          national_id_number: nationalId.trim() || profile.national_id_number,
          national_id_expires_at: nationalExpiresAt || profile.national_id_expires_at || null,
          id_docs_consent_at: idDocsConsent
            ? profile.id_docs_consent_at ?? new Date().toISOString()
            : profile.id_docs_consent_at,
          emergency_name: emergencyName.trim() || profile.emergency_name,
          emergency_phone: cleanEmergency || profile.emergency_phone,
          last_seen_ip: ip ?? profile.last_seen_ip ?? null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      if (englishNameOk(fullNameEn)) {
        const { error: nameError } = await supabase.auth.updateUser({
          data: { full_name_en: cleanName(fullNameEn) },
        });
        if (nameError) throw nameError;
      }
      await refreshProfile();
      baseline.current = currentSnap;
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

  const bookingBanner = resumeId
    ? incomplete
      ? {
          icon: 'sparkles' as const,
          text: t(isStudent ? 'profile.completeHint' : 'profile.completeHintRenter'),
          onPress: () => setTab(accountIncomplete ? 'account' : 'trust'),
        }
      : {
          icon: 'calendar' as const,
          text: t('profile.continueBooking'),
          onPress: () => router.replace({ pathname: '/(student)/book/[id]', params: { id: resumeId } }),
        }
    : null;

  const heroMetas = [
    ...(ageLabel(birthDate, t, today) ? [{ icon: 'hourglass-outline' as const, text: ageLabel(birthDate, t, today) }] : []),
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
      back={tab !== 'menu'}
      onBack={goHub}
      footer={
        tab === 'account' || tab === 'trust' ? (
          <Button
            title={t('profile.saveProfile')}
            onPress={saveProfile}
            loading={saving}
            disabled={!dirty}
            pill
          />
        ) : null
      }
      scrollRef={scrollRef}
    >
      <ProfileEnter scene={tab} reverse={tab === 'menu'} enterOnMount>
      {tab === 'menu' ? (
        <>
          <View onLayout={(event) => { sectionY.current.hero = event.nativeEvent.layout.y; }}>
            <ProfileHero
              name={displayName({ full_name: fullNameAr, full_name_en: fullNameEn }, i18n.language) || t('profile.title')}
              avatarUrl={avatarUrl}
              uploading={uploading}
              onChangePhoto={() => void changePhoto()}
              metas={heroMetas}
              chip={t(`roles.${profile?.role ?? 'student'}`)}
              email={profile?.email}
              verifyStatus={profile?.id_verify_status}
              verifyRole={profile?.role}
              progressFilled={progressItems.filter((item) => item.done).length}
              progressTotal={progressItems.length}
            />
          </View>
          {needsReview ? (
            <ProfileBanner
              icon="star"
              text={t('review.neededBody')}
              onPress={() => router.push('/(student)/(tabs)/bookings')}
            />
          ) : null}
          {bookingBanner ? (
            <ProfileBanner icon={bookingBanner.icon} text={bookingBanner.text} onPress={bookingBanner.onPress} />
          ) : null}
          {progressItems.some((item) => !item.done) ? (
            <View style={[styles.gaps, row]}>
              {progressItems
                .filter((item) => !item.done)
                .slice(0, 4)
                .map((item) => (
                  <Pressable
                    key={item.id ?? item.label}
                    onPress={() => item.id && jumpTo(item.id)}
                    style={[styles.gapChip, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
                  >
                    <Text style={[styles.gapChipText, { color: colors.text }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
            </View>
          ) : null}
          <ProfileMenu
            groups={[
              [
                {
                  key: 'account',
                  icon: 'person-outline',
                  label: t('profile.personalTitle'),
                  hint: accountIncomplete ? t('profile.stillNeeded') : undefined,
                  dot: accountIncomplete,
                  onPress: () => setTab('account'),
                },
                {
                  key: 'trust',
                  icon: 'shield-checkmark-outline',
                  label: t('profile.tabTrust'),
                  hint: trustIncomplete ? t('profile.stillNeeded') : undefined,
                  dot: trustIncomplete,
                  onPress: () => setTab('trust'),
                },
              ],
              [
                {
                  key: 'settings',
                  icon: 'options-outline',
                  label: t('profile.tabSettings'),
                  onPress: () => setTab('settings'),
                },
                {
                  key: 'security',
                  icon: 'lock-closed-outline',
                  label: t('profile.tabSecurity'),
                  hint: mfaOn ? undefined : t('profile.mfaOptionalHint'),
                  onPress: () => setTab('security'),
                },
              ],
              [
                {
                  key: 'saved',
                  icon: 'heart-outline',
                  label: t('profile.tabSaved'),
                  hint: shouldShowSavedCount(profile)
                    ? t('profile.itemCount', { count: savedListings.length })
                    : undefined,
                  onPress: () => setTab('saved'),
                },
                {
                  key: 'bookings',
                  icon: 'calendar-outline',
                  label: t('tabs.bookings'),
                  hint: needsReview
                    ? t('review.neededTitle')
                    : resumeId
                      ? t('profile.continueBooking')
                      : undefined,
                  dot: needsReview || Boolean(resumeId),
                  onPress: () => router.push('/(student)/(tabs)/bookings'),
                },
              ],
            ]}
          />
        </>
      ) : (
        <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>
          {tab === 'account'
            ? t('profile.personalTitle')
            : tab === 'trust'
              ? t('profile.tabTrust')
              : tab === 'settings'
                ? t('profile.tabSettings')
                : tab === 'saved'
                  ? t('profile.tabSaved')
                  : t('profile.tabSecurity')}
        </Text>
      )}

      {tab === 'trust' && profile?.id_verify_status === 'rejected' ? (
        <ProfileBanner
          icon="alert-circle"
          text={
            profile.id_verify_note
              ? t('profile.idRejectedBody', { note: profile.id_verify_note })
              : t('profile.idRejectedHint')
          }
          onPress={() => jumpTo('nationalCard')}
        />
      ) : null}

      {tab === 'trust' && profile?.id_verify_status === 'pending' && (nationalIdUrl || universityCardUrl) ? (
        <ProfileBanner icon="time-outline" text={t('profile.idPendingHint')} onPress={() => jumpTo('nationalCard')} />
      ) : null}

      {tab === 'trust' ? (
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
              ...(isStudent && degreeLabelText ? [{ icon: 'ribbon-outline' as const, text: degreeLabelText }] : []),
              ...(isStudent && studyYear
                ? [
                    {
                      icon: 'calendar-outline' as const,
                      text: yearOptions.find((item) => item.value === studyYear)?.label ?? '',
                    },
                  ]
                : []),
              ...(isStudent && studentId.trim()
                ? [{ icon: 'id-card-outline' as const, text: `${t('profile.studentId')} ${studentId}` }]
                : []),
              ...(phoneLocal.trim() &&
              canShowSeekerContact(
                { phone_visibility: profile?.phone_visibility ?? 'booking' },
                'phone',
                { bookingStatus: 'pending' },
              )
                ? [{ icon: 'call-outline' as const, text: `${regionPrefix(phoneRegion)} ${phoneLocal}` }]
                : []),
              ...(waLocal.trim() &&
              canShowSeekerContact(
                { whatsapp_visibility: profile?.whatsapp_visibility ?? 'booking' },
                'whatsapp',
                { bookingStatus: 'pending' },
              )
                ? [{ icon: 'logo-whatsapp' as const, text: `${regionPrefix(waRegion)} ${waLocal}` }]
                : []),
              ...(homeAddress.trim()
                ? [{ icon: 'home-outline' as const, text: homeAddress.trim() }]
                : []),
              ...(nationalIdUrl
                ? [{ icon: 'id-card-outline' as const, text: t('profile.idCardsReady') }]
                : []),
              ...(shouldShareEmergency(profile) && emergencyName.trim()
                ? [{ icon: 'alert-circle-outline' as const, text: emergencyName.trim() }]
                : []),
              ...(shouldShowLastSeen(profile) && profile?.last_seen_ip
                ? [{ icon: 'globe-outline' as const, text: profile.last_seen_ip }]
                : []),
            ].filter((item) => item.text)}
          />
          <ProfileSafetyFields
            isStudent={isStudent}
            nationalId={nationalId}
            onNationalId={(value) => setNationalId(sanitizeNationalId(value))}
            nationalExpiresAt={nationalExpiresAt}
            onNationalExpiresAt={setNationalExpiresAt}
            idDocsConsent={idDocsConsent}
            onIdDocsConsent={setIdDocsConsent}
            nationalUri={nationalPreview}
            universityUri={universityPreview}
            uploadingDoc={uploadingDoc}
            onUploadNational={() => void uploadCard('national')}
            onUploadUniversity={() => void uploadCard('university')}
            emergencyName={emergencyName}
            onEmergencyName={setEmergencyName}
            emergencyRegion={emergencyRegion}
            emergencyLocal={emergencyLocal}
            onEmergency={(region, local) => {
              setEmergencyRegion(region);
              setEmergencyLocal(local);
            }}
            onSectionLayout={(section, y) => {
              sectionY.current[section] = y;
            }}
          />
        </>
      ) : null}

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
            homeAddress={homeAddress}
            onHomeAddress={setHomeAddress}
            bio={bio}
            onBio={setBio}
            spokenLanguages={spokenLanguages}
            onSpokenLanguages={setSpokenLanguages}
            graduationTerm={graduationTerm}
            onGraduationTerm={setGraduationTerm}
            onSectionLayout={(section, y) => {
              sectionY.current[section] = y;
            }}
          />
          {isStudent ? (
            <Card compact onLayout={(event) => { sectionY.current.studies = event.nativeEvent.layout.y; }}>
              <View style={styles.denseBlock}>
                <SectionHead compact icon="school-outline" title={t('profile.studiesTitle')} />
                <SearchSelect
                  dense
                  label={t('auth.studyUniversity')}
                  value={universityId}
                  placeholder={t('common.select')}
                  options={universityOptions}
                  onChange={setUniversityId}
                  clearable
                />
                {universityId && universityId !== (profile?.university_id ?? '') ? (
                  <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
                    {t('profile.universityChangeHint', { email: SUPPORT_EMAIL })}
                  </Text>
                ) : null}
                <Input
                  compact
                  label={t('profile.studentId')}
                  value={studentId}
                  onChangeText={(value) => setStudentId(cleanStudentId(value))}
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
                <Select
                  dense
                  label={t('profile.degree')}
                  value={degreeLevel}
                  placeholder={t('common.select')}
                  options={degreeOptions}
                  onChange={setDegreeLevel}
                  clearable
                />
                <Select
                  dense
                  label={t('profile.studyYear')}
                  value={studyYear}
                  placeholder={t('common.select')}
                  options={yearOptions}
                  onChange={setStudyYear}
                  clearable
                />
              </View>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'settings' && profile ? (
        <ProfileSettingsFields
          profile={profile}
          onSaved={async () => {
            await refreshProfile();
          }}
        />
      ) : null}

      {tab === 'saved' ? (
        <Card compact>
          <SectionHead
            compact
            icon="heart-outline"
            title={
              savedListings.length > 0
                ? t('profile.savedCount', { count: savedListings.length })
                : t('profile.savedListings')
            }
          />
          {savedListings.length === 0 ? (
            <EmptyState
              title={t('profile.savedEmpty')}
              actionTitle={t('profile.browseListings')}
              onAction={() => router.push('/(student)/(tabs)/search')}
            />
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
        <ProfileSecurity
          onDelete={canDeleteAccount ? removeAccount : undefined}
          deleting={deleting}
        />
      ) : null}
      </ProfileEnter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  gaps: { flexWrap: 'wrap', gap: 6 },
  gapChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  gapChipText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', flexShrink: 1 },
  label: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  denseBlock: { gap: spacing.xs },
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
  hint: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
  warn: {
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  warnText: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: 'Cairo_600SemiBold' },
});

