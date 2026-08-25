import Ionicons from '@expo/vector-icons/Ionicons';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';

export function BrandLoader() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Ionicons name="home" size={40} color={colors.primary} />
        <View style={styles.gold} />
      </View>
      <Text style={styles.name}>بدك سكن؟ اطلب منا</Text>
      <ActivityIndicator color={colors.primary} style={styles.spin} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  circle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gold: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  name: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.primary,
    textAlign: 'center',
  },
  spin: { marginTop: 8 },
});
