import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { lightColors } from '@/src/theme/colors';

export function BrandLoader() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: lightColors.background }]}>
      <BrandLogo width={200} />
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
  spinner: {
    marginTop: 20,
  },
});
