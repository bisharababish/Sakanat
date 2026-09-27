import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AddressMapPicker } from '@/components/profile/AddressMapPicker';
import { NameField } from '@/components/profile/NameField';
import { SectionHead } from '@/components/profile/SectionHead';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { FilterPills } from '@/components/ui/FilterPills';
import { languageCodes, packStudentLive, readStudentLive, type LiveStyle, type StudyShift } from '@/src/lib/studentLive';
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
  /** Once saved, gender stays fixed. */
  genderLocked?: boolean;
  cityId: string;
  onCityId: (value: string) => void;
  cityOptions: { value: string; label: string; lat?: number; lng?: number }[];
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
  bio?: string;
  onBio?: (value: string) => void;
  bioHint?: string;
  spokenLanguages?: string[];
  onSpokenLanguages?: (value: string[]) => void;
  showLive?: boolean;
  graduationTerm?: string;
  onGraduationTerm?: (value: string) => void;
  campusEmailHint?: boolean;
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
  genderLocked = false,
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
  bio = '',
  onBio,
  bioHint,
  spokenLanguages = [],
  onSpokenLanguages,
  showLive = false,
  graduationTerm = '',
  onGraduationTerm,
  campusEmailHint = false,
  onSectionLayout,
}: Props) {
  const { t } = useTranslation();
  const { rtlText, row } = useLayout();
  const colors = useColors();
  const numbersMatch = sameMobile(phoneRegion, phoneLocal, waRegion, waLocal);
  const sameNumber = numbersMatch && waLinked;
  const [mapOpen, setMapOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const mapLockRef = useRef(false);
  const mapCenter = useMemo(() => {
    const city = cityOptions.find((item) => item.value === cityId);
    if (city?.lat != null && city?.lng != null) return { lat: city.lat, lng: city.lng };
    return null;
  }, [cityId, cityOptions]);

  const openMap = () => {
    if (mapLockRef.current) return;
    setMapOpen(true);
  };

  const closeMap = () => {
    mapLockRef.current = true;
    setMapOpen(false);
    setTimeout(() => {
      mapLockRef.current = false;
    }, 600);
  };

  const pickHomeAddress = (address: string) => {
    onHomeAddress?.(address);
    closeMap();
  };

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
        <View style={styles.denseBlock}>
          <SectionHead compact icon="text-outline" title={t('profile.namesTitle')} />
          <NameField
            compact
            label={t('common.nameEn')}
            value={fullNameEn}
            onChangeText={onFullNameEn}
            script="en"
          />
          <NameField
            compact
            label={t('common.nameAr')}
            value={fullNameAr}
            onChangeText={onFullNameAr}
            script="ar"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.denseBlock}>
          <SectionHead compact icon="id-card-outline" title={t('profile.aboutTitle')} />
          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.gender')}</Text>
          {genderLocked ? (
            <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
              {gender === 'male' || gender === 'female' ? t(`profile.${gender}`) : '—'}
              {' · '}
              {t('profile.genderLocked')}
            </Text>
          ) : (
            <FilterPills<PersonGender | ''>
              compact
              value={gender}
              onChange={onGender}
              allowDeselect
              items={[
                { value: 'male', label: t('profile.male') },
                { value: 'female', label: t('profile.female') },
              ]}
            />
          )}
          <Select
            dense
            label={t('auth.homeCity')}
            value={cityId}
            placeholder={t('common.select')}
            options={cityOptions}
            onChange={onCityId}
            clearable
          />
          {onHomeAddress ? (
            <>
              <Pressable onPress={openMap} accessibilityRole="button">
                <View pointerEvents="none">
                  <Input
                    compact
                    label={t('profile.homeAddress')}
                    value={homeAddress ?? ''}
                    onChangeText={() => undefined}
                    placeholder={t('profile.homeAddressPick')}
                    editable={false}
                    multiline
                  />
                </View>
              </Pressable>
              <AddressMapPicker
                visible={mapOpen}
                onClose={closeMap}
                onPick={pickHomeAddress}
                initial={mapCenter}
              />
            </>
          ) : null}
          <DateField compact label={t('profile.birthDate')} value={birthDate} onChange={onBirthDate} />
        </View>
      </Card>
      <Card compact onLayout={(event) => onSectionLayout?.('contact', event.nativeEvent.layout.y)}>
        <View style={styles.denseBlock}>
          <SectionHead compact icon="call-outline" title={t('profile.contactTitle')} />
          <Input
            compact
            label={t('common.email')}
            value={email}
            onChangeText={() => undefined}
            editable={false}
            wrap
            ltr
            hint={
              campusEmailHint
                ? `${t('profile.emailLocked')} ${t('profile.emailCampusHint', { email: SUPPORT_EMAIL })}`
                : t('profile.emailLocked')
            }
          />
          <PhoneField
            compact
            label={t('common.phone')}
            region={phoneRegion}
            local={phoneLocal}
            onRegionChange={(region) => onPhone(region, phoneLocal)}
            onLocalChange={(value) => onPhone(phoneRegion, value)}
          />
          <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.whatsapp')}</Text>
          <FilterPills
            compact
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
              compact
              label={t('profile.whatsapp')}
              region={waRegion}
              local={waLocal}
              onRegionChange={(region) => onWhatsapp(region, waLocal)}
              onLocalChange={(value) => onWhatsapp(waRegion, value)}
            />
          )}
          {phoneLocal.trim() && waLocal.trim() && !numbersMatch ? (
            <View style={[styles.warn, row, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="warning" size={14} color={colors.warning} />
              <Text style={[styles.warnText, rtlText, { color: colors.text }]}>{t('profile.whatsappDifferentWarn')}</Text>
            </View>
          ) : null}
        </View>
      </Card>
      {onBio || onSpokenLanguages || onGraduationTerm ? (
        <Card compact>
          <Pressable
            onPress={() => setMoreOpen((open) => !open)}
            style={[styles.moreHead, row]}
            accessibilityRole="button"
          >
            <View style={styles.moreTitle}>
              <SectionHead compact icon="ellipsis-horizontal" title={t('profile.moreOptional')} />
            </View>
            <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </Pressable>
          {moreOpen ? (
            <View style={styles.denseBlock}>
              <Text style={[styles.moreHint, rtlText, { color: colors.textMuted }]}>{t('profile.moreOptionalHint')}</Text>
              {onBio ? (
                <Input
                  compact
                  label={t('profile.bio')}
                  value={bio}
                  onChangeText={onBio}
                  multiline
                  hint={bioHint || t('profile.bioHint')}
                />
              ) : null}
              {onSpokenLanguages ? (
                <>
                  <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('profile.spokenLanguages')}</Text>
                  <FilterPills
                    compact
                    values={languageCodes(spokenLanguages)}
                    onToggle={(value) => {
                      const selected = languageCodes(spokenLanguages);
                      const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
                      onSpokenLanguages(packStudentLive(next, readStudentLive(spokenLanguages)));
                    }}
                    items={[
                      { value: 'ar', label: t('profile.langAr') },
                      { value: 'en', label: t('profile.langEn') },
                      { value: 'he', label: t('profile.langHe') },
                    ]}
                  />
                </>
              ) : null}
              {showLive && onSpokenLanguages ? (
                <>
                  <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('live.title')}</Text>
                  <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('live.hint')}</Text>
                  <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('live.shiftLabel')}</Text>
                  <FilterPills
                    compact
                    value={readStudentLive(spokenLanguages).shift}
                    onChange={(shift) =>
                      onSpokenLanguages(packStudentLive(spokenLanguages, { ...readStudentLive(spokenLanguages), shift: shift as StudyShift }))
                    }
                    allowDeselect
                    items={(['morning', 'evening', 'mixed'] as StudyShift[]).map((value) => ({
                      value,
                      label: t(`live.shift.${value}`),
                    }))}
                  />
                  <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('live.smokerLabel')}</Text>
                  <FilterPills
                    compact
                    value={readStudentLive(spokenLanguages).smoker}
                    onChange={(smoker) =>
                      onSpokenLanguages(
                        packStudentLive(spokenLanguages, {
                          ...readStudentLive(spokenLanguages),
                          smoker: smoker as 'yes' | 'no',
                        }),
                      )
                    }
                    allowDeselect
                    items={[
                      { value: 'no', label: t('live.smokerNo') },
                      { value: 'yes', label: t('live.smokerYes') },
                    ]}
                  />
                  <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('live.furnitureLabel')}</Text>
                  <FilterPills
                    compact
                    value={readStudentLive(spokenLanguages).furniture}
                    onChange={(furniture) =>
                      onSpokenLanguages(
                        packStudentLive(spokenLanguages, {
                          ...readStudentLive(spokenLanguages),
                          furniture: furniture as 'yes' | 'no',
                        }),
                      )
                    }
                    allowDeselect
                    items={[
                      { value: 'no', label: t('live.furnitureNo') },
                      { value: 'yes', label: t('live.furnitureYes') },
                    ]}
                  />
                  <Text style={[styles.denseLabel, rtlText, { color: colors.text }]}>{t('live.styleLabel')}</Text>
                  <FilterPills
                    compact
                    value={readStudentLive(spokenLanguages).style}
                    onChange={(style) =>
                      onSpokenLanguages(packStudentLive(spokenLanguages, { ...readStudentLive(spokenLanguages), style: style as LiveStyle }))
                    }
                    allowDeselect
                    items={(['quiet', 'social', 'either'] as LiveStyle[]).map((value) => ({
                      value,
                      label: t(`live.style.${value}`),
                    }))}
                  />
                </>
              ) : null}
              {onGraduationTerm ? (
                <Input
                  compact
                  label={t('profile.graduationTerm')}
                  value={graduationTerm}
                  onChangeText={onGraduationTerm}
                  placeholder={t('profile.graduationTermHint')}
                  ltr
                />
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  denseBlock: { gap: spacing.xs },
  denseLabel: { fontWeight: '700', fontSize: 12, fontFamily: 'Cairo_700Bold' },
  hint: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 0 },
  moreHead: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  moreTitle: { flex: 1, minWidth: 0 },
  moreHint: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular', marginBottom: 4 },
  warn: {
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  warnText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Cairo_600SemiBold' },
});
