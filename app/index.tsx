import { BrandLoader } from '@/components/BrandLoader';
import { Redirect, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { apartmentIdFromAppUrl } from '@/src/lib/pushRouting';
import { rememberGuestApartment, seekerHomeOrListing } from '@/src/lib/guest';
import { colors, spacing } from '@/src/theme/colors';

export default function Gate() {
  const { t } = useTranslation();
  const { textAlign } = useLayout();
  const { configured, loading, session, profile, mfaPending, mfaEnrollRequired } = useAuth();
  const [href, setHref] = useState<Href | null>(null);

  useEffect(() => {
    if (!configured || loading || (session && !profile)) {
      setHref(null);
      return;
    }
    if (mfaPending) {
      setHref('/(auth)/mfa');
      return;
    }
    if (mfaEnrollRequired) {
      setHref('/(auth)/mfa-enroll');
      return;
    }
    if (session && profile) {
      setHref(seekerHomeOrListing(profile.role) as Href);
      return;
    }
    let alive = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (!alive) return;
        const id = apartmentIdFromAppUrl(url);
        if (id) {
          rememberGuestApartment(id);
          setHref({ pathname: '/(guest)/apartment/[id]', params: { id } });
        } else setHref('/(auth)/welcome');
      })
      .catch(() => {
        if (alive) setHref('/(auth)/welcome');
      });
    return () => {
      alive = false;
    };
  }, [configured, loading, session, profile, mfaPending, mfaEnrollRequired]);

  if (!configured) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { textAlign }]}>{t('auth.setupTitle')}</Text>
        <Text style={[styles.body, { textAlign }]}>{t('auth.setupBody')}</Text>
      </View>
    );
  }

  if (loading || (session && !profile) || !href) {
    return <BrandLoader />;
  }

  return <Redirect href={href} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, color: colors.textMuted, lineHeight: 24 },
});
