import { useTranslation } from 'react-i18next';

export function useLayout() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  return {
    isRtl,
    lang: (isRtl ? 'ar' : 'en') as 'ar' | 'en',
    row: { flexDirection: isRtl ? 'row-reverse' : 'row' } as const,
    textAlign: (isRtl ? 'right' : 'left') as 'left' | 'right',
    writingDirection: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    alignEnd: isRtl ? 'flex-start' : 'flex-end',
    alignStart: isRtl ? 'flex-end' : 'flex-start',
  };
}
