import Ionicons from '@expo/vector-icons/Ionicons';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { colors } from '@/src/theme/colors';

export function BrandLoader() {
  const { t } = useTranslation();
  const { writingDirection } = useLayout();

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Ionicons name="home" size={40} color={colors.primary} />
        <View style={styles.gold} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={[styles.lead, { writingDirection }]}>{t('appNameLead')}</Text>
        <Text style={[styles.tail, { writingDirection }]}>{t('appNameTail')}</Text>
      </View>
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
    paddingHorizontal: 28,
    paddingVertical: 32,
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
  titleBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  lead: {
    fontSize: 28,
    lineHeight: 44,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: 2,
  },
  tail: {
    fontSize: 22,
    lineHeight: 36,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.accent,
    textAlign: 'center',
    paddingVertical: 2,
  },
  spin: { marginTop: 8 },
});
