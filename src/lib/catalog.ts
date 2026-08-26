const listeners = new Set<() => void>();

export function notifyCatalogChanged() {
  listeners.forEach((fn) => fn());
}

export function subscribeCatalog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
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
