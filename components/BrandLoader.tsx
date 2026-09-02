import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { lightColors } from '@/src/theme/colors';

export function BrandLoader() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.wrap}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="بدك سكن؟ اطلب منا"
      />
      <ActivityIndicator size="large" color={lightColors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 240,
    height: 240,
  },
  spinner: {
    marginTop: 28,
  },
});
