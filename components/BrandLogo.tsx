import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

/** Native logo.jpeg size — keep this ratio everywhere. */
const LOGO_W = 918;
const LOGO_H = 612;
const ASPECT = LOGO_W / LOGO_H;

const LOGO = require('@/assets/images/logo.jpeg');

type Props = {
  /** Display width; height follows the logo’s real shape. */
  width?: number;
  /** Compact menu / chrome mark (width in px). */
  badge?: boolean;
  size?: number;
};

/**
 * Renders logo.jpeg at its true aspect — no crop, no stretch, no extra plate.
 * The file already includes the green field + white wordmark.
 */
export function BrandLogo({ width = 168, badge = false, size = 36 }: Props) {
  const { t } = useTranslation();
  const w = badge ? size : width;
  const h = Math.round(w / ASPECT);

  return (
    <Image
      source={LOGO}
      style={[styles.logo, { width: w, height: h, borderRadius: badge ? 8 : 12 }]}
      contentFit="contain"
      accessibilityLabel={t('appName')}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
});
