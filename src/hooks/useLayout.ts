import { I18nManager, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

export function useLayout() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const flipped = isRtl !== I18nManager.isRTL;
  const alignStart: 'flex-start' | 'flex-end' = flipped ? 'flex-end' : 'flex-start';
  const alignEnd: 'flex-start' | 'flex-end' = flipped ? 'flex-start' : 'flex-end';
  const textAlign = (isRtl ? 'right' : 'left') as 'left' | 'right';
  const writingDirection = (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr';

  return {
    isRtl,
    lang: (isRtl ? 'ar' : 'en') as 'ar' | 'en',
    row: { flexDirection: flipped ? 'row-reverse' : 'row' } as const,
    textAlign,
    writingDirection,
    alignEnd,
    alignStart,
    rtlText: {
      textAlign,
      writingDirection,
      alignSelf: 'stretch',
      width: '100%',
    } as TextStyle,
  };
}
