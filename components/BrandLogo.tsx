import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  plate?: boolean;
  iconOnly?: boolean;
};

/** Logo file is 1024²: mark sits ~169–686, Arabic wordmark starts ~712. */
const ICON_TOP = 120 / 1024;
const ICON_BOTTOM = 700 / 1024;
const ICON_RATIO = ICON_BOTTOM - ICON_TOP;

export function BrandLogo({ size = 180, plate = false, iconOnly = false }: Props) {
  const height = iconOnly ? Math.round(size * ICON_RATIO) : size;
  const image = (
    <Image
      source={require('@/assets/images/logo.png')}
      style={{
        width: size,
        height: size,
        marginTop: iconOnly ? -Math.round(size * ICON_TOP) : 0,
      }}
      contentFit="contain"
      accessibilityLabel="بدك سكن؟ اطلب منا"
    />
  );
  const mark = iconOnly ? (
    <View style={{ width: size, height, overflow: 'hidden' }}>{image}</View>
  ) : (
    image
  );
  if (!plate) return mark;
  return <View style={[styles.plate, { width: size + 20, height: height + 20 }]}>{mark}</View>;
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: 'rgba(28, 36, 30, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(28, 36, 30, 0.08)',
  },
});
