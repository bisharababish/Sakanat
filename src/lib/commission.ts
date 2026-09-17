import { supabase } from '@/src/lib/supabase';

export const DEFAULT_COMMISSION_PERCENT = 6;

export function commissionAmount(rent: number, occupants: number, percent: number) {
  const people = Math.max(1, occupants);
  return Math.round(rent * percent * people) / 100;
}

export async function loadCommissionPercent() {
  try {
    const { data } = await supabase.from('app_settings').select('commission_percent').eq('id', 1).maybeSingle();
    const value = Number(data?.commission_percent);
    if (Number.isFinite(value) && value >= 0 && value <= 100) return value;
  } catch {
    // Fall back to the product default.
  }
  return DEFAULT_COMMISSION_PERCENT;
}
