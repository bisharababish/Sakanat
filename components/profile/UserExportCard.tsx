import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLayout } from '@/src/hooks/useLayout';
import type { UserExportBundle } from '@/src/lib/dataExport';
import { localizedName } from '@/src/lib/format';
import { displayName } from '@/src/lib/name';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

export const UserExportCard = forwardRef<View, { bundle: UserExportBundle }>(function UserExportCard(
  { bundle },
  ref,
) {
  const { t, i18n } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const p = bundle.profile;
  const city = localizedName(p.cities, i18n.language);
  const university = localizedName(p.universities, i18n.language);

  const line = (label: string, value?: string | null) =>
    value ? (
      <Text key={label} style={[styles.line, rtlText, { color: colors.text }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}: </Text>
        {value}
      </Text>
    ) : null;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.brand, rtlText, { color: colors.primary }]}>{t('appName')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('profile.exportSummaryTitle')}</Text>
      <Text style={[styles.name, rtlText, { color: colors.text }]}>{displayName(p, i18n.language)}</Text>
      <Text style={[styles.role, rtlText, { color: colors.primary }]}>{t(`roles.${p.role}`)}</Text>
      {line(t('common.email'), p.email)}
      {line(t('common.phone'), p.phone)}
      {line(t('profile.whatsapp'), p.whatsapp)}
      {line(t('auth.homeCity'), city)}
      {line(t('profile.university'), university)}
      {line(t('profile.nationalId'), p.national_id_number)}
      {line(t('profile.idVerifyStatus'), p.id_verify_status)}
      {line(t('profile.homeAddress'), p.home_address)}
      {line(t('profile.emergencyName'), p.emergency_name)}
      {line(t('profile.emergencyPhone'), p.emergency_phone)}
      <View style={[styles.stats, { borderTopColor: colors.border }]}>
        <Text style={[styles.stat, rtlText, { color: colors.textMuted }]}>
          {t('profile.exportBookings')}: {bundle.bookings.length}
        </Text>
        <Text style={[styles.stat, rtlText, { color: colors.textMuted }]}>
          {t('profile.exportChats')}: {bundle.conversations.length}
        </Text>
        <Text style={[styles.stat, rtlText, { color: colors.textMuted }]}>
          {t('profile.exportSaved')}: {bundle.savedApartmentIds.length}
        </Text>
      </View>
      <Text style={[styles.footer, rtlText, { color: colors.textMuted }]}>
        {new Date(bundle.exportedAt).toLocaleString(i18n.language.startsWith('ar') ? 'ar' : 'en')}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    width: 320,
  },
  brand: { fontSize: 12, fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 13, fontFamily: 'Cairo_700Bold', marginBottom: 4 },
  name: { fontSize: 18, fontFamily: 'Cairo_800ExtraBold' },
  role: { fontSize: 12, fontFamily: 'Cairo_700Bold', marginBottom: 6 },
  line: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
  label: { fontFamily: 'Cairo_700Bold' },
  stats: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 8, gap: 2 },
  stat: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  footer: { fontSize: 10, fontFamily: 'Cairo_400Regular', marginTop: 6 },
});
