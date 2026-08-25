import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { authErrorMessage } from '@/src/lib/authErrors';
import { localizedName } from '@/src/lib/format';
import { toE164, type PhoneRegion } from '@/src/lib/phone';
import { colors } from '@/src/theme/colors';
import type { PersonGender } from '@/src/types/database';

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, isRtl } = useLayout();
  const { signUp } = useAuth();
  const { cities, universities } = useCatalog();
  const [fullName, setFullName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cityId, setCityId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [gender, setGender] = useState<PersonGender | ''>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lang = i18n.language;

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, lang) })),
    [cities, lang],
  );
  const universityOptions = useMemo(
    () =>
      universities
        .filter((item) => !cityId || item.city_id === cityId)
        .map((item) => ({
          value: item.id,
          label: item.cities
            ? `${localizedName(item, lang)} — ${localizedName(item.cities, lang)}`
            : localizedName(item, lang),
        })),
    [cityId, universities, lang],
  );

  const setCity = (next: string) => {
    setCityId(next);
    if (next && universityId) {
      const stillValid = universities.some((item) => item.id === universityId && item.city_id === next);
      if (!stillValid) setUniversityId('');
    }
  };

  const onSubmit = async () => {
    setError('');
    if (!fullName || !email || !password || !gender || !phoneLocal.trim() || !cityId || !universityId) {
      setError(t('auth.missingFields'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.weakPassword'));
      return;
    }
    const cleanPhone = toE164(phoneRegion, phoneLocal);
    if (!cleanPhone) {
      setError(t('phone.invalid'));
      return;
    }
    setLoading(true);
    try {
      const result = await signUp({
        email,
        password,
        fullName,
        phone: cleanPhone,
        role: 'student',
        cityId,
        universityId,
        gender,
        language: lang.startsWith('ar') ? 'ar' : 'en',
      });
      if (result === 'verify') {
        router.replace({ pathname: '/(auth)/verify-email', params: { email } });
      }
    } catch (err) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen back center={false}>
      <AuthBrand compact />
      <AuthCard>
        <Text style={[styles.title, rtlText]}>{t('auth.registerTitle')}</Text>
        <Text style={[styles.hint, rtlText]}>{t('auth.registerHint')}</Text>
        <Text style={[styles.roleHint, rtlText]}>{t('auth.studentHint')}</Text>
        <Text style={[styles.label, rtlText]}>{t('profile.gender')}</Text>
        <View style={[styles.roles, { justifyContent: isRtl ? 'flex-end' : 'flex-start' }]}>
          <Chip label={t('profile.male')} selected={gender === 'male'} onPress={() => setGender('male')} />
          <Chip label={t('profile.female')} selected={gender === 'female'} onPress={() => setGender('female')} />
        </View>
        <Input label={t('common.name')} value={fullName} onChangeText={setFullName} soft />
        <PhoneField
          label={t('common.phone')}
          region={phoneRegion}
          local={phoneLocal}
          onRegionChange={setPhoneRegion}
          onLocalChange={setPhoneLocal}
          soft
        />
        <Input
          label={t('auth.studentEmail')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          ltr
          hint={t('auth.studentEmailHint')}
          soft
        />
        <Input label={t('common.password')} value={password} onChangeText={setPassword} secureTextEntry soft />
        <Select
          label={t('auth.homeCity')}
          value={cityId}
          placeholder={t('common.select')}
          options={cityOptions}
          onChange={setCity}
          soft
        />
        <SearchSelect
          label={t('auth.studyUniversity')}
          value={universityId}
          placeholder={t('common.select')}
          options={universityOptions}
          onChange={setUniversityId}
        />
        {error ? <Text style={[styles.error, rtlText]}>{error}</Text> : null}
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={14} color={colors.primary} />
          <Text style={styles.lock}>{t('auth.secureNote')}</Text>
        </View>
      </AuthCard>
      <Button title={t('auth.register')} onPress={onSubmit} loading={loading} pill />
      <Pressable onPress={() => router.push('/(auth)/login')} style={styles.footer}>
        <Text style={[styles.footerText, rtlText]}>
          {t('auth.hasAccount')} <Text style={styles.link}>{t('auth.login')}</Text>
        </Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Cairo_800ExtraBold',
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: -4,
  },
  label: { color: colors.text, fontWeight: '700', fontFamily: 'Cairo_700Bold', fontSize: 14 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  roleHint: { color: colors.textMuted, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  error: { color: colors.danger, fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  lockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lock: { color: colors.textMuted, fontSize: 12, fontFamily: 'Cairo_400Regular' },
  footer: { alignItems: 'center', paddingVertical: 8, paddingBottom: 16 },
  footerText: { color: colors.textMuted, fontSize: 15, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
});
