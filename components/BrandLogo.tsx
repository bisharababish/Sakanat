import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

/** Transparent wordmark (logo-mark.png) — green field removed. */
const LOGO_W = 548;
const LOGO_H = 228;
const ASPECT = LOGO_W / LOGO_H;

const LOGO = require('@/assets/images/logo-mark.png');

type Props = {
  /** Display width; height follows the mark’s real shape. */
  width?: number;
  /** Compact menu / chrome mark (width in px). */
  badge?: boolean;
  size?: number;
};

/**
 * Renders the Matra7 wordmark with a transparent background.
 */
export function BrandLogo({ width = 168, badge = false, size = 36 }: Props) {
  const { t } = useTranslation();
  const w = badge ? size : width;
  const h = Math.round(w / ASPECT);

  return (
    <Image
      source={LOGO}
      style={[styles.logo, { width: w, height: h }]}
      contentFit="contain"
      accessibilityLabel={t('appName')}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
  },
});
