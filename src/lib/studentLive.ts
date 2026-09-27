import type { TFunction } from 'i18next';

export type StudyShift = 'morning' | 'evening' | 'mixed';
export type LiveStyle = 'quiet' | 'social' | 'either';

export type StudentLive = {
  shift: StudyShift | '';
  smoker: 'yes' | 'no' | '';
  furniture: 'yes' | 'no' | '';
  style: LiveStyle | '';
};

const SHIFT = new Set<StudyShift>(['morning', 'evening', 'mixed']);
const STYLE = new Set<LiveStyle>(['quiet', 'social', 'either']);

export function isLiveToken(value: string) {
  return value.startsWith('~');
}

export function languageCodes(list: string[] | null | undefined) {
  return (list ?? []).filter((item) => item === 'ar' || item === 'en' || item === 'he');
}

export function readStudentLive(list: string[] | null | undefined): StudentLive {
  const live: StudentLive = { shift: '', smoker: '', furniture: '', style: '' };
  for (const item of list ?? []) {
    if (!isLiveToken(item)) continue;
    const body = item.slice(1);
    const cut = body.indexOf('=');
    if (cut < 0) continue;
    const key = body.slice(0, cut);
    const value = body.slice(cut + 1);
    if (key === 'shift' && SHIFT.has(value as StudyShift)) live.shift = value as StudyShift;
    else if (key === 'smoke' && (value === 'yes' || value === 'no')) live.smoker = value;
    else if (key === 'furniture' && (value === 'yes' || value === 'no')) live.furniture = value;
    else if (key === 'style' && STYLE.has(value as LiveStyle)) live.style = value as LiveStyle;
  }
  return live;
}

export function packStudentLive(languages: string[], live: StudentLive) {
  const base = languageCodes(languages);
  const tokens: string[] = [];
  if (live.shift) tokens.push(`~shift=${live.shift}`);
  if (live.smoker) tokens.push(`~smoke=${live.smoker}`);
  if (live.furniture) tokens.push(`~furniture=${live.furniture}`);
  if (live.style) tokens.push(`~style=${live.style}`);
  return [...base, ...tokens];
}

export function studentLiveLines(list: string[] | null | undefined, t: TFunction) {
  const live = readStudentLive(list);
  const lines: string[] = [];
  if (live.shift) lines.push(t(`live.shift.${live.shift}`));
  if (live.smoker) lines.push(t(live.smoker === 'yes' ? 'live.smokerYes' : 'live.smokerNo'));
  if (live.furniture) lines.push(t(live.furniture === 'yes' ? 'live.furnitureYes' : 'live.furnitureNo'));
  if (live.style) lines.push(t(`live.style.${live.style}`));
  return lines;
}
