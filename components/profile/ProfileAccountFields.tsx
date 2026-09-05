import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NameField } from '@/components/profile/NameField';
import { SectionHead } from '@/components/profile/SectionHead';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { Select } from '@/components/ui/Select';
import { useLayout } from '@/src/hooks/useLayout';
import { sameMobile, type PhoneRegion } from '@/src/lib/phone';
import { SUPPORT_EMAIL } from '@/src/lib/support';
import { radius, spacing } from '@/src/theme/colors';
import { useColors } from '@/src/theme/ThemeProvider';
import type { PersonGender } from '@/src/types/database';

type Section = 'names' | 'about' | 'contact';

type Props = {
  email: string;
  fullNameEn: string;
  onFullNameEn: (value: string) => void;
  fullNameAr: string;
  onFullNameAr: (value: string) => void;
  gender: PersonGender | '';
  onGender: (value: PersonGender | '') => void;
  cityId: string;
  onCityId: (value: string) => void;
  cityOptions: { value: string; label: string }[];
  birthDate: string;
  onBirthDate: (value: string) => void;
  phoneRegion: PhoneRegion;
  phoneLocal: string;
  onPhone: (region: PhoneRegion, local: string) => void;
  waRegion: PhoneRegion;
  waLocal: string;
  onWhatsapp: (region: PhoneRegion, local: string) => void;
  waLinked: boolean;
  onWaLinked: (linked: boolean) => void;
  homeAddress?: string;
  onHomeAddress?: (value: string) => void;
  onSectionLayout?: (section: Section, y: number) => void;
};

export function ProfileAccountFields({
  email,
  fullNameEn,
  onFullNameEn,
  fullNameAr,
  onFullNameAr,
  gender,
  onGender,
  cityId,
  onCityId,
  cityOptions,
  birthDate,
  onBirthDate,
  phoneRegion,
  phoneLocal,
  onPhone,
  waRegion,
  waLocal,
  onWhatsapp,
  waLinked,
  onWaLinked,
  homeAddress,
  onHomeAddress,
  onSectionLayout,
}: Props) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const numbersMatch = sameMobile(phoneRegion, phoneLocal, waRegion, waLocal);
  const sameNumber = numbersMatch && waLinked;

  return (
    <>
      <Card
        compact
        onLayout={(event) => {
          const y = event.nativeEvent.layout.y;
          onSectionLayout?.('names', y);
          onSectionLayout?.('about', y);
        }}
      >
        <View style={styles.block}>
          <SectionHead compact icon="text-outline" title={t('profile.namesTitle')} />
          <NameField label={t('common.nameEn')} value={fullNameEn} onChangeText={onFullNameEn} script="en" />
          <NameField label={t('common.nameAr')} value={fullNameAr} onChangeText={onFullNameAr} script="ar" />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.block}>
          <SectionHead compact icon="id-card-outline" title={t('profile.aboutTitle')} />
          <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.gender')}</Text>
          <FilterPills<PersonGender | ''>
            value={gender}
            onChange={onGender}
            allowDeselect
            items={[
              { value: 'male', label: t('profile.male') },
              { value: 'female', label: t('profile.female') },
            ]}
          />
          <Select
            label={t('auth.homeCity')}
            value={cityId}
            placeholder={t('common.select')}
            options={cityOptions}
            onChange={onCityId}
            clearable
          />
          {onHomeAddress ? (
            <Input
              label={t('profile.homeAddress')}
              value={homeAddress ?? ''}
              onChangeText={onHomeAddress}
              multiline
            />
          ) : null}
          <DateField label={t('profile.birthDate')} value={birthDate} onChange={onBirthDate} />
        </View>
      </Card>
      <Card compact onLayout={(event) => onSectionLayout?.('contact', event.nativeEvent.layout.y)}>
        <SectionHead compact icon="call-outline" title={t('profile.contactTitle')} />
        <Input
          label={t('common.email')}
          value={email}
          onChangeText={() => undefined}
          editable={false}
          wrap
          ltr
          hint={`${t('profile.emailLocked')} ${t('profile.emailCampusHint', { email: SUPPORT_EMAIL })}`}
        />
        <PhoneField
          label={t('common.phone')}
          region={phoneRegion}
          local={phoneLocal}
          onRegionChange={(region) => onPhone(region, phoneLocal)}
          onLocalChange={(value) => onPhone(phoneRegion, value)}
        />
        <Text style={[styles.label, rtlText, { color: colors.text }]}>{t('profile.whatsapp')}</Text>
        <FilterPills
          value={sameNumber ? 'same' : 'different'}
          onChange={(value) => {
            if (value === 'same') {
              onWhatsapp(phoneRegion, phoneLocal);
              onWaLinked(true);
            } else {
              onWaLinked(false);
            }
          }}
          items={[
            { value: 'same', label: t('profile.sameAsPhone') },
            { value: 'different', label: t('profile.differentNumber') },
          ]}
        />
        {sameNumber ? null : (
          <PhoneField
            label={t('profile.whatsapp')}
            region={waRegion}
            local={waLocal}
            onRegionChange={(region) => onWhatsapp(region, waLocal)}
            onLocalChange={(value) => onWhatsapp(waRegion, value)}
          />
        )}
        {phoneLocal.trim() && waLocal.trim() && !numbersMatch ? (
          <View style={[styles.warn, row, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={[styles.warnText, rtlText, { color: colors.text }]}>{t('profile.whatsappDifferentWarn')}</Text>
          </View>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  label: { fontWeight: '700', fontSize: 13, fontFamily: 'Cairo_700Bold' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  warn: {
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  warnText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_600SemiBold' },
});
