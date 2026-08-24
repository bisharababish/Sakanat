import { I18nManager, type FlexAlignType, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

export function useLayout() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const flipped = isRtl !== I18nManager.isRTL;
  const alignStart = (flipped ? 'flex-end' : 'flex-start') as FlexAlignType;
  const alignEnd = (flipped ? 'flex-start' : 'flex-end') as FlexAlignType;
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
