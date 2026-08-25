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

export const lightColors: Palette = {
  primary: '#2D5A3D',
  primaryDark: '#1F3F2B',
  primarySoft: '#E4EFE7',
  accent: '#C4A35A',
  accentSoft: '#F4E9CF',
  background: '#F6F1E7',
  surface: '#FFFFFF',
  surfaceMuted: '#EFE8DA',
  text: '#1C241E',
  textMuted: '#5E6B62',
  border: '#D9D0C0',
  danger: '#B42318',
  dangerSoft: '#FCE8E6',
  success: '#176C3A',
  successSoft: '#E3F5EA',
  warning: '#A15C07',
  warningSoft: '#FEF4E4',
  info: '#1D4E89',
  infoSoft: '#E6F0FA',
  white: '#FFFFFF',
  overlay: 'rgba(28, 36, 30, 0.45)',
};

export const darkColors: Palette = {
  primary: '#6FBF86',
  primaryDark: '#8FCB9E',
  primarySoft: '#1E3326',
  accent: '#D4B56C',
  accentSoft: '#3A3220',
  background: '#121614',
  surface: '#1C221E',
  surfaceMuted: '#262C28',
  text: '#F3EEE4',
  textMuted: '#A8B3AB',
  border: '#323A34',
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
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  full: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
};
