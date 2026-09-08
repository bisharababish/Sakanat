import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { trackEvent } from '@/src/lib/analytics';
import { isStudentReady } from '@/src/lib/studentProfile';
import { ownerReadyForListing } from '@/src/lib/trust';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

function storageKey(userId: string) {
  return `sakanat.onboarded.${userId}`;
}

export function OnboardingGate() {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile?.id) {
      setVisible(false);
      return;
    }
    if (profile.role !== 'student' && profile.role !== 'renter' && profile.role !== 'owner') {
      setVisible(false);
      return;
    }
    let cancelled = false;
    void AsyncStorage.getItem(storageKey(profile.id)).then((value) => {
      if (!cancelled && value !== '1') setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

  if (!profile || !visible) return null;

  const isOwner = profile.role === 'owner';
  const ready = isOwner ? ownerReadyForListing(profile) : isStudentReady(profile);
  const steps = isOwner
    ? [t('onboarding.ownerStepProfile'), t('onboarding.ownerStepId'), t('onboarding.ownerStepListing')]
    : [t('onboarding.studentStepProfile'), t('onboarding.studentStepPrefs'), t('onboarding.studentStepSearch')];

  const dismiss = async () => {
    await AsyncStorage.setItem(storageKey(profile.id), '1');
    setVisible(false);
    void trackEvent('onboarding_done', { role: profile.role }, profile.id);
  };

  const goNext = async () => {
    await dismiss();
    if (isOwner) {
      router.push(ready ? '/(owner)/listing/new' : '/(owner)/(tabs)/profile');
      return;
    }
    router.push(ready ? '/(student)/(tabs)/search' : '/(student)/(tabs)/profile');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void dismiss()}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => void dismiss()} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('onboarding.welcome')}</Text>
          <Text style={[styles.title, rtlText, { color: colors.text }]}>
            {isOwner ? t('onboarding.ownerTitle') : t('onboarding.studentTitle')}
          </Text>
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
            {isOwner ? t('onboarding.ownerHint') : t('onboarding.studentHint')}
          </Text>
          {steps.map((step, index) => (
            <Text key={step} style={[styles.step, rtlText, { color: colors.text }]}>
              {index + 1}. {step}
            </Text>
          ))}
          <Button
            title={ready ? t('onboarding.continueReady') : t('onboarding.continueProfile')}
            pill
            onPress={() => void goNext()}
          />
          <Button title={t('onboarding.skip')} variant="ghost" pill onPress={() => void dismiss()} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    zIndex: 1,
  },
  kicker: { fontSize: 12, fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 22, fontFamily: 'Cairo_800ExtraBold' },
  hint: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  step: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_600SemiBold' },
});
