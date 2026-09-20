import { supabase } from '@/src/lib/supabase';

export type AnalyticsName =
  | 'search_open'
  | 'listing_view'
  | 'booking_request'
  | 'listing_submit'
  | 'chat_open'
  | 'report_submit'
  | 'review_submit'
  | 'onboarding_done';

const CONSENT_KEY = 'sakanat.analytics.consent';

let consentCache: boolean | null = null;

export async function setAnalyticsConsent(on: boolean, userId?: string) {
  consentCache = on;
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(CONSENT_KEY, on ? 'on' : 'off');
  } catch {
    // local optional
  }
  if (userId) {
    await supabase.from('profiles').update({ analytics_consent: on }).eq('id', userId);
  }
}

export async function loadAnalyticsConsent(profileConsent?: boolean | null) {
  if (profileConsent === false) {
    consentCache = false;
    return false;
  }
  if (profileConsent === true) {
    consentCache = true;
    return true;
  }
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const saved = await AsyncStorage.getItem(CONSENT_KEY);
    consentCache = saved !== 'off';
  } catch {
    consentCache = true;
  }
  return consentCache !== false;
}

export async function trackEvent(
  name: AnalyticsName,
  props: Record<string, unknown> = {},
  userId?: string | null,
) {
  try {
    if (consentCache === false) return;
    if (consentCache == null && userId) {
      const ok = await loadAnalyticsConsent();
      if (!ok) return;
    }
    await supabase.from('app_events').insert({
      user_id: userId ?? null,
      name,
      props,
    });
  } catch {
    // Analytics must never break the app.
  }
}

export type AnalyticsSummary = {
  days: number;
  totals: Record<string, number>;
  byCampus: { universityId: string; views: number; books: number; conversion: number }[];
  byDay: { key: string; label: string; views: number; books: number }[];
  conversion: number;
};

export async function loadAnalyticsSummary(days = 7): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('app_events')
    .select('name, props, created_at')
    .gte('created_at', since)
    .limit(4000);
  if (error) throw error;

  const totals: Record<string, number> = {};
  const campus = new Map<string, { views: number; books: number }>();
  const dayMap = new Map<string, { views: number; books: number }>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    dayMap.set(key, { views: 0, books: 0 });
  }

  for (const row of data ?? []) {
    totals[row.name] = (totals[row.name] ?? 0) + 1;
    const props = (row.props ?? {}) as Record<string, unknown>;
    const uni = typeof props.universityId === 'string' ? props.universityId : '';
    const dayKey = String(row.created_at).slice(0, 10);
    const day = dayMap.get(dayKey);
    if (uni) {
      const bucket = campus.get(uni) ?? { views: 0, books: 0 };
      if (row.name === 'listing_view') bucket.views += 1;
      if (row.name === 'booking_request') bucket.books += 1;
      campus.set(uni, bucket);
    }
    if (day) {
      if (row.name === 'listing_view') day.views += 1;
      if (row.name === 'booking_request') day.books += 1;
    }
  }

  const views = totals.listing_view ?? 0;
  const books = totals.booking_request ?? 0;

  return {
    days,
    totals,
    conversion: views > 0 ? Math.round((books / views) * 100) : 0,
    byCampus: [...campus.entries()]
      .map(([universityId, value]) => ({
        universityId,
        ...value,
        conversion: value.views > 0 ? Math.round((value.books / value.views) * 100) : 0,
      }))
      .sort((a, b) => b.views + b.books - (a.views + a.books))
      .slice(0, 8),
    byDay: [...dayMap.entries()].map(([key, value]) => ({
      key,
      label: key.slice(5),
      views: value.views,
      books: value.books,
    })),
  };
}
