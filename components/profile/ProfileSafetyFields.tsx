import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import { IdDocField } from '@/components/profile/IdDocField';
import { NationalIdExpiryBadge } from '@/components/profile/NationalIdExpiryBadge';
import { SectionHead } from '@/components/profile/SectionHead';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { useLayout } from '@/src/hooks/useLayout';
import type { PhoneRegion } from '@/src/lib/phone';
import {
  isValidNationalId,
  isValidNationalIdExpiry,
  nationalIdChecksumOk,
  nationalIdExpiryState,
} from '@/src/lib/trust';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Section = 'docs' | 'emergency';

export function ProfileSafetyFields({
  isStudent,
  nationalId,
  onNationalId,
  nationalExpiresAt,
  onNationalExpiresAt,
  idDocsConsent,
  onIdDocsConsent,
  nationalUri,
  universityUri,
  uploadingDoc,
  onUploadNational,
  onUploadUniversity,
  emergencyName,
  onEmergencyName,
  emergencyRegion,
  emergencyLocal,
  onEmergency,
  onSectionLayout,
}: {
  isStudent: boolean;
  nationalId: string;
  onNationalId: (value: string) => void;
  nationalExpiresAt: string;
  onNationalExpiresAt: (value: string) => void;
  idDocsConsent: boolean;
  onIdDocsConsent: (value: boolean) => void;
  nationalUri?: string | null;
  universityUri?: string | null;
  uploadingDoc?: boolean;
  onUploadNational: () => void;
  onUploadUniversity: () => void;
  emergencyName: string;
  onEmergencyName: (value: string) => void;
  emergencyRegion: PhoneRegion;
  emergencyLocal: string;
  onEmergency: (region: PhoneRegion, local: string) => void;
  onSectionLayout?: (section: Section, y: number) => void;
}) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const idHint =
    nationalId.length === 9 && !nationalIdChecksumOk(nationalId)
      ? t('profile.nationalIdInvalid')
      : nationalId.length > 0 && nationalId.length < 9
        ? t('profile.nationalIdHint')
        : isValidNationalId(nationalId)
          ? t('profile.nationalIdOk')
          : t('profile.nationalIdHint');
  const expiryState = nationalIdExpiryState(nationalExpiresAt || null);
  const expiryHint =
    !nationalExpiresAt
      ? t('profile.idExpiryHint')
      : expiryState === 'expired'
        ? t('profile.idExpiryInvalid')
        : expiryState === 'soon'
          ? t('profile.idExpiresSoon')
          : t('profile.idExpiryValid');
  const expiryColor =
    expiryState === 'ok'
      ? colors.success
      : expiryState === 'soon'
        ? colors.warning
        : expiryState === 'expired' || (nationalExpiresAt && !isValidNationalIdExpiry(nationalExpiresAt))
          ? colors.danger
          : colors.textMuted;

  return (
    <Card
      compact
      onLayout={(event) => {
        const y = event.nativeEvent.layout.y;
        onSectionLayout?.('docs', y);
        onSectionLayout?.('emergency', y);
      }}
    >
      <View style={styles.denseBlock}>
        <SectionHead compact icon="shield-checkmark-outline" title={t('profile.trustTitle')} />
        <Input
          compact
          label={t('profile.nationalId')}
          value={nationalId}
          onChangeText={onNationalId}
          keyboardType="number-pad"
          ltr
          hint={idHint}
        />
        <DateField
          compact
          kind="expiry"
          label={t('profile.nationalIdExpiry')}
          value={nationalExpiresAt}
          onChange={onNationalExpiresAt}
        />
        <View style={[styles.expiryRow, row]}>
          <Text style={[styles.mini, rtlText, { color: expiryColor, flex: 1 }]}>{expiryHint}</Text>
          {nationalExpiresAt ? <NationalIdExpiryBadge expiresAt={nationalExpiresAt} /> : null}
        </View>
        <Pressable
          onPress={() => onIdDocsConsent(!idDocsConsent)}
          style={[styles.consent, row]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: idDocsConsent }}
        >
          <Ionicons
            name={idDocsConsent ? 'checkbox' : 'square-outline'}
            size={22}
            color={idDocsConsent ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.consentText, rtlText, { color: colors.text }]}>{t('profile.idConsent')}</Text>
        </Pressable>
        <Text style={[styles.mini, rtlText, { color: colors.textMuted }]}>{t('profile.idConsentHint')}</Text>
        <IdDocField
          compact
          label={t('profile.nationalCard')}
          uri={nationalUri}
          busy={uploadingDoc}
          onPress={onUploadNational}
        />
        {isStudent ? (
          <IdDocField
            compact
            label={t('profile.universityCard')}
            uri={universityUri}
            busy={uploadingDoc}
            onPress={onUploadUniversity}
          />
        ) : null}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.denseBlock}>
        <SectionHead compact icon="alert-circle-outline" title={t('profile.emergencyTitle')} />
        <Input
          compact
          label={t('profile.emergencyName')}
          value={emergencyName}
          onChangeText={onEmergencyName}
          hint={t('profile.emergencyNameHint')}
        />
        <PhoneField
          compact
          label={t('profile.emergencyPhone')}
          region={emergencyRegion}
          local={emergencyLocal}
          onRegionChange={(region) => onEmergency(region, emergencyLocal)}
          onLocalChange={(value) => onEmergency(emergencyRegion, value)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  denseBlock: { gap: spacing.xs },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 0 },
  mini: { fontSize: 11, lineHeight: 15, fontFamily: 'Cairo_400Regular' },
  expiryRow: { alignItems: 'center', gap: 8 },
  consent: { alignItems: 'flex-start', gap: 8, minHeight: 36 },
  consentText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Cairo_600SemiBold' },
});
