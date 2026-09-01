import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { colors } from '@/src/theme/colors';

export function BrandLoader() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.wrap}>
      <BrandLogo size={220} plate iconOnly />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
});
