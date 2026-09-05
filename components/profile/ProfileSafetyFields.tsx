import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { IdDocField } from '@/components/profile/IdDocField';
import { SectionHead } from '@/components/profile/SectionHead';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import type { PhoneRegion } from '@/src/lib/phone';
import { spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';

type Section = 'docs' | 'emergency';

export function ProfileSafetyFields({
  isStudent,
  nationalId,
  onNationalId,
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
  const colors = useColors();

  return (
    <Card
      compact
      onLayout={(event) => {
        const y = event.nativeEvent.layout.y;
        onSectionLayout?.('docs', y);
        onSectionLayout?.('emergency', y);
      }}
    >
      <View style={styles.block}>
        <SectionHead compact icon="shield-checkmark-outline" title={t('profile.trustTitle')} />
        <Input
          label={t('profile.nationalId')}
          value={nationalId}
          onChangeText={onNationalId}
          keyboardType="number-pad"
          ltr
        />
        <IdDocField
          label={t('profile.nationalCard')}
          uri={nationalUri}
          busy={uploadingDoc}
          onPress={onUploadNational}
        />
        {isStudent ? (
          <IdDocField
            label={t('profile.universityCard')}
            uri={universityUri}
            busy={uploadingDoc}
            onPress={onUploadUniversity}
          />
        ) : null}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.block}>
        <SectionHead compact icon="alert-circle-outline" title={t('profile.emergencyTitle')} />
        <Input
          label={t('profile.emergencyName')}
          value={emergencyName}
          onChangeText={onEmergencyName}
        />
        <PhoneField
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
  block: { gap: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
});
