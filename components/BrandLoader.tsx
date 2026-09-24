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
    <View style={[styles.wrap, { backgroundColor: lightColors.background }]}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Matrah"
      />
      <ActivityIndicator size="large" color={lightColors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 220,
    height: 220,
  },
  spinner: {
    marginTop: 24,
  },
});
