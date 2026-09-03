import { supabase, uniqueChannel } from '@/src/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const listeners = new Set<() => void>();
let live: RealtimeChannel | null = null;
let liveRefs = 0;

/** One realtime channel shared by every useCatalog() screen. */

export function notifyCatalogChanged() {
  listeners.forEach((fn) => fn());
}

export function subscribeCatalog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function watchCatalogLive() {
  liveRefs += 1;
  if (!live) {
    live = uniqueChannel('catalog-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cities' }, notifyCatalogChanged)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'universities' }, notifyCatalogChanged)
      .subscribe();
  }
  return () => {
    liveRefs = Math.max(0, liveRefs - 1);
    if (liveRefs === 0 && live) {
      const current = live;
      live = null;
      void supabase.removeChannel(current);
    }
  };
}

export function slugify(raw: string) {
  const ascii = raw
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii;
}

export function parseCoord(raw: string) {
  const value = Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(value) ? value : null;
}

export function parseDomains(raw: string) {
  return [...new Set(raw.split(/[,;\n]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))];
}
