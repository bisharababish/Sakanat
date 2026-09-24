export type Palette = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  white: string;
  overlay: string;
};

/**
 * Matrah light — cool mist stone + deep teal-ink (not cream/gold cliché).
 * Feels grounded, campus-adjacent, distinct from generic housing apps.
 */
export const lightColors: Palette = {
  primary: '#1B4A3C',
  primaryDark: '#12352C',
  primarySoft: '#E2F0EA',
  accent: '#9A7B4F',
  accentSoft: '#F2EBE0',
  background: '#EEF1EF',
  surface: '#FFFFFF',
  surfaceMuted: '#E6EBE8',
  text: '#15241F',
  textMuted: '#5A6B64',
  border: '#D0D9D4',
  danger: '#B42318',
  dangerSoft: '#FCE8E6',
  success: '#176C3A',
  successSoft: '#E3F5EA',
  warning: '#9A6700',
  warningSoft: '#FEF7E6',
  info: '#1D4E89',
  infoSoft: '#E6F0FA',
  white: '#FFFFFF',
  overlay: 'rgba(18, 36, 31, 0.48)',
};

export const darkColors: Palette = {
  primary: '#6FBF9A',
  primaryDark: '#8FD0B0',
  primarySoft: '#1A2E28',
  accent: '#C4A574',
  accentSoft: '#2E2A22',
  background: '#0E1412',
  surface: '#171E1B',
  surfaceMuted: '#222B27',
  text: '#F0F4F2',
  textMuted: '#9AABA3',
  border: '#2C3833',
  danger: '#E85D54',
  dangerSoft: '#3A1E1C',
  success: '#5DCF86',
  successSoft: '#173325',
  warning: '#E2B15A',
  warningSoft: '#3A2E16',
  info: '#7EB0E0',
  infoSoft: '#1A2A3A',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

/** Light fallback for boot / BrandLoader before the theme provider mounts. */
export const colors = lightColors;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  full: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
};

/** Soft elevation for interactive surfaces */
export const elevation = {
  card: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  toast: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
