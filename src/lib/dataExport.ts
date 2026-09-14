import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { localizedName } from '@/src/lib/format';
import { displayName } from '@/src/lib/name';
import { supabase } from '@/src/lib/supabase';
import { idDocUrl } from '@/src/lib/upload';
import type { Profile } from '@/src/types/database';

export type UserExportBundle = {
  profile: Profile;
  bookings: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  savedApartmentIds: string[];
  reports: Record<string, unknown>[];
  nationalCardUrl: string | null;
  universityCardUrl: string | null;
  exportedAt: string;
};

function csvEscape(value: unknown) {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return '';
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = keys.map(csvEscape).join(',');
  const body = rows.map((row) => keys.map((key) => csvEscape(row[key])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export async function loadUserExportBundle(userId: string): Promise<UserExportBundle> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, cities(*), universities(*)')
    .eq('id', userId)
    .single();
  if (error || !profile) throw error ?? new Error('User not found');

  const [bookingsRes, convosRes, savedRes, reportsRes, nationalCardUrl, universityCardUrl] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id, apartment_id, student_id, owner_id, start_date, months, status, payment_method, payment_status, occupants, rent_amount, created_at',
        )
        .or(`student_id.eq.${userId},owner_id.eq.${userId}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('conversations')
        .select('id, apartment_id, student_id, owner_id, last_message_at, last_message')
        .or(`student_id.eq.${userId},owner_id.eq.${userId}`)
        .order('last_message_at', { ascending: false }),
      supabase.from('saved_apartments').select('apartment_id').eq('student_id', userId),
      supabase
        .from('app_reports')
        .select('id, kind, subject, body, status, admin_note, created_at')
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false }),
      idDocUrl((profile as Profile).national_id_url),
      idDocUrl((profile as Profile).university_card_url),
    ]);

  return {
    profile: profile as Profile,
    bookings: bookingsRes.error ? [] : ((bookingsRes.data as Record<string, unknown>[]) ?? []),
    conversations: convosRes.error ? [] : ((convosRes.data as Record<string, unknown>[]) ?? []),
    savedApartmentIds: savedRes.error
      ? []
      : ((savedRes.data as { apartment_id: string }[]) ?? []).map((row) => row.apartment_id),
    reports: reportsRes.error ? [] : ((reportsRes.data as Record<string, unknown>[]) ?? []),
    nationalCardUrl,
    universityCardUrl,
    exportedAt: new Date().toISOString(),
  };
}

export function buildUserExportCsv(bundle: UserExportBundle, lang: string) {
  const p = bundle.profile;
  const profileRow: Record<string, unknown> = {
    id: p.id,
    email: p.email,
    full_name_ar: p.full_name,
    full_name_en: p.full_name_en,
    role: p.role,
    phone: p.phone,
    whatsapp: p.whatsapp,
    gender: p.gender,
    date_of_birth: p.date_of_birth,
    city: localizedName(p.cities, lang),
    university: localizedName(p.universities, lang),
    student_id_number: p.student_id_number,
    major: p.major,
    degree_level: p.degree_level,
    study_year: p.study_year,
    home_address: p.home_address,
    national_id_number: p.national_id_number,
    id_verify_status: p.id_verify_status,
    id_verify_note: p.id_verify_note,
    id_verified_at: p.id_verified_at,
    emergency_name: p.emergency_name,
    emergency_phone: p.emergency_phone,
    last_seen_ip: p.last_seen_ip,
    account_status: p.account_status,
    created_at: p.created_at,
    exported_at: bundle.exportedAt,
    national_card_url: bundle.nationalCardUrl,
    university_card_url: bundle.universityCardUrl,
  };

  const sections = [
    '# profile',
    rowsToCsv([profileRow]),
    '',
    '# bookings',
    rowsToCsv(bundle.bookings) || 'id',
    '',
    '# conversations',
    rowsToCsv(bundle.conversations) || 'id',
    '',
    '# saved_apartments',
    rowsToCsv(bundle.savedApartmentIds.map((apartment_id) => ({ apartment_id }))) || 'apartment_id',
    '',
    '# reports',
    rowsToCsv(bundle.reports) || 'id',
  ];
  return sections.join('\n');
}

export function buildUserExportSummaryText(
  bundle: UserExportBundle,
  lang: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const p = bundle.profile;
  const lines = [
    t('appName'),
    t('profile.exportSummaryTitle'),
    `—`,
    `${t('common.name')}: ${displayName(p, lang)}`,
    `${t('profile.role')}: ${t(`roles.${p.role}`)}`,
    p.email ? `${t('common.email')}: ${p.email}` : '',
    p.phone ? `${t('common.phone')}: ${p.phone}` : '',
    p.whatsapp ? `${t('profile.whatsapp')}: ${p.whatsapp}` : '',
    localizedName(p.cities, lang) ? `${t('auth.homeCity')}: ${localizedName(p.cities, lang)}` : '',
    localizedName(p.universities, lang) ? `${t('profile.university')}: ${localizedName(p.universities, lang)}` : '',
    p.national_id_number ? `${t('profile.nationalId')}: ${p.national_id_number}` : '',
    p.id_verify_status ? `${t('profile.idVerifyStatus')}: ${p.id_verify_status}` : '',
    p.home_address ? `${t('profile.homeAddress')}: ${p.home_address}` : '',
    p.emergency_name ? `${t('profile.emergencyName')}: ${p.emergency_name}` : '',
    p.emergency_phone ? `${t('profile.emergencyPhone')}: ${p.emergency_phone}` : '',
    `${t('profile.exportBookings')}: ${bundle.bookings.length}`,
    `${t('profile.exportChats')}: ${bundle.conversations.length}`,
    `${t('profile.exportSaved')}: ${bundle.savedApartmentIds.length}`,
    `${t('menu.version', { version: bundle.exportedAt })}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export async function shareCsvFile(filename: string, contents: string) {
  const safe = filename.replace(/[^\w.-]+/g, '_');
  const file = new File(Paths.cache, safe);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: safe,
      UTI: 'public.comma-separated-values-text',
    });
    return;
  }
  await Share.share({ message: contents, title: safe });
}

export async function shareImageUri(uri: string, dialogTitle?: string) {
  const path = uri.startsWith('file://') ? uri : `file://${uri}`;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'image/png',
      dialogTitle,
      UTI: 'public.png',
    });
    return;
  }
  await Share.share({ url: path, message: dialogTitle });
}

export async function shareTextFallback(message: string, title?: string) {
  await Share.share({ message, title });
}

export async function exportPlatformBookingsCsv() {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, payment_method, payment_status, start_date, months, occupants, rent_amount, commission_amount, created_at, student:profiles!student_id(full_name, email), owner:profiles!owner_id(full_name, email), apartments(title_ar, title_en)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = ((data as Record<string, unknown>[]) ?? []).map((item) => {
    const student = item.student as { full_name?: string; email?: string } | null;
    const owner = item.owner as { full_name?: string; email?: string } | null;
    const apt = item.apartments as { title_ar?: string; title_en?: string } | null;
    return {
      id: item.id,
      status: item.status,
      payment_method: item.payment_method,
      payment_status: item.payment_status,
      start_date: item.start_date,
      months: item.months,
      occupants: item.occupants,
      rent_amount: item.rent_amount,
      commission_amount: item.commission_amount,
      created_at: item.created_at,
      student_name: student?.full_name,
      student_email: student?.email,
      owner_name: owner?.full_name,
      owner_email: owner?.email,
      listing_ar: apt?.title_ar,
      listing_en: apt?.title_en,
    };
  });
  const csv = rowsToCsv(rows) || 'id';
  const stamp = new Date().toISOString().slice(0, 10);
  await shareCsvFile(`sakanat-bookings-${stamp}.csv`, csv);
  return rows.length;
}

export async function exportOwnerEarningsCsv(ownerId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, status, payment_method, payment_status, start_date, months, occupants, rent_amount, commission_amount, commission_percent, created_at, student:profiles!student_id(full_name, email), apartments(title_ar, title_en, building_name, floor, unit_number)',
    )
    .eq('owner_id', ownerId)
    .in('status', ['confirmed', 'completed'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = ((data as Record<string, unknown>[]) ?? []).map((item) => {
    const student = item.student as { full_name?: string; email?: string } | null;
    const apt = item.apartments as {
      title_ar?: string;
      title_en?: string;
      building_name?: string | null;
      floor?: number | null;
      unit_number?: string | null;
    } | null;
    const rent = Number(item.rent_amount) || 0;
    const fee = Number(item.commission_amount) || 0;
    return {
      id: item.id,
      status: item.status,
      payment_method: item.payment_method,
      payment_status: item.payment_status,
      start_date: item.start_date,
      months: item.months,
      occupants: item.occupants,
      rent_amount: rent,
      commission_amount: fee,
      owner_keep: Math.max(0, rent - fee),
      commission_percent: item.commission_percent,
      created_at: item.created_at,
      student_name: student?.full_name,
      student_email: student?.email,
      listing_ar: apt?.title_ar,
      listing_en: apt?.title_en,
      building_name: apt?.building_name,
      floor: apt?.floor,
      unit_number: apt?.unit_number,
    };
  });
  const csv = rowsToCsv(rows) || 'id';
  const stamp = new Date().toISOString().slice(0, 10);
  await shareCsvFile(`sakanat-earnings-${stamp}.csv`, csv);
  return rows.length;
}

export async function exportUsersCsv() {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, full_name_en, role, phone, city_id, university_id, owner_status, id_verify_status, account_status, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  const csv = rowsToCsv((data as Record<string, unknown>[]) ?? []) || 'id';
  const stamp = new Date().toISOString().slice(0, 10);
  await shareCsvFile(`sakanat-users-${stamp}.csv`, csv);
  return (data ?? []).length;
}

export async function exportListingsCsv() {
  const { data, error } = await supabase
    .from('apartments')
    .select(
      'id, title_ar, title_en, status, price_month, rooms, bathrooms, city_id, nearest_university_id, owner_id, review_avg, review_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  const csv = rowsToCsv((data as Record<string, unknown>[]) ?? []) || 'id';
  const stamp = new Date().toISOString().slice(0, 10);
  await shareCsvFile(`sakanat-listings-${stamp}.csv`, csv);
  return (data ?? []).length;
}

export async function exportReportsCsv() {
  const { data, error } = await supabase
    .from('app_reports')
    .select(
      'id, kind, subject, status, admin_note, reporter_id, target_user_id, target_apartment_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  const csv = rowsToCsv((data as Record<string, unknown>[]) ?? []) || 'id';
  const stamp = new Date().toISOString().slice(0, 10);
  await shareCsvFile(`sakanat-reports-${stamp}.csv`, csv);
  return (data ?? []).length;
}

export async function exportReviewsCsv() {
  const { data, error } = await supabase
    .from('apartment_reviews')
    .select(
      'id, apartment_id, student_id, stars, note, author_name, owner_reply, owner_replied_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  const csv = rowsToCsv((data as Record<string, unknown>[]) ?? []) || 'id';
  const stamp = new Date().toISOString().slice(0, 10);
  await shareCsvFile(`sakanat-reviews-${stamp}.csv`, csv);
  return (data ?? []).length;
}
