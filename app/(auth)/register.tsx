import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { toE164, type PhoneRegion } from '@/src/lib/phone';
import { colors, radius } from '@/src/theme/colors';
import type { UserRole } from '@/src/types/database';

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart } = useLayout();
  const { signUp } = useAuth();
  const { cities, universities } = useCatalog();
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('student');
  const [fullName, setFullName] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cityId, setCityId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lang = i18n.language;

  const cityOptions = useMemo(
    () => cities.map((city) => ({ value: city.id, label: localizedName(city, lang) })),
    [cities, lang],
  );
  const universityOptions = useMemo(
    () =>
      universities.map((item) => ({
        value: item.id,
        label: item.cities
          ? `${localizedName(item, lang)} — ${localizedName(item.cities, lang)}`
          : localizedName(item, lang),
      })),
    [universities, lang],
  );

  const onSubmit = async () => {
    setError('');
    if (!fullName || !email || !password) {
      setError(t('auth.missingFields'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.weakPassword'));
      return;
    }
    const cleanPhone = phoneLocal.trim() ? toE164(phoneRegion, phoneLocal) : null;
    if (phoneLocal.trim() && !cleanPhone) {
      setError(t('phone.invalid'));
      return;
    }
    if (!cityId || (role === 'student' && !universityId)) {
      setError(t('auth.missingFields'));
      return;
    }
    setLoading(true);
    try {
      const result = await signUp({
        email,
        password,
        fullName,
        phone: cleanPhone ?? '',
        role,
        cityId,
        universityId,
        language: lang.startsWith('ar') ? 'ar' : 'en',
      });
      router.replace(result === 'verify' ? { pathname: '/(auth)/verify-email', params: { email } } : '/');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      setError(message === 'studentEmailRequired' ? t('auth.studentEmailRequired') : message === 'invalidEmail' ? t('auth.invalidEmail') : message);
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
        <Text style={[styles.label, rtlText]}>{t('auth.chooseRole')}</Text>
        <View style={[styles.roles, { justifyContent: alignStart }]}>
          <Pressable style={[styles.role, role === 'student' && styles.roleOn]} onPress={() => setRole('student')}>
            <Text style={[styles.roleLabel, role === 'student' && styles.roleLabelOn]}>{t('roles.student')}</Text>
          </Pressable>
          <Pressable style={[styles.role, role === 'owner' && styles.roleOn]} onPress={() => setRole('owner')}>
            <Text style={[styles.roleLabel, role === 'owner' && styles.roleLabelOn]}>{t('roles.owner')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.roleHint, rtlText]}>{role === 'student' ? t('auth.studentHint') : t('auth.ownerHint')}</Text>
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
          label={role === 'student' ? t('auth.studentEmail') : t('common.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          ltr
          hint={role === 'student' ? t('auth.studentEmailHint') : undefined}
          soft
        />
        <Input label={t('common.password')} value={password} onChangeText={setPassword} secureTextEntry soft />
        <Select
          label={t('auth.homeCity')}
          value={cityId}
          placeholder={t('common.select')}
          options={cityOptions}
          onChange={setCityId}
          soft
        />
        {role === 'student' ? (
          <Select
            label={t('auth.studyUniversity')}
            value={universityId}
            placeholder={t('common.select')}
            options={universityOptions}
            onChange={setUniversityId}
            soft
          />
        ) : null}
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
  role: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  roleOn: { backgroundColor: colors.primary },
  roleLabel: { fontWeight: '700', fontFamily: 'Cairo_700Bold', color: colors.text },
  roleLabelOn: { color: colors.white },
  roleHint: { color: colors.textMuted, fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  error: { color: colors.danger, fontWeight: '600', fontFamily: 'Cairo_600SemiBold' },
  lockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lock: { color: colors.textMuted, fontSize: 12, fontFamily: 'Cairo_400Regular' },
  footer: { alignItems: 'center', paddingVertical: 8, paddingBottom: 16 },
  footerText: { color: colors.textMuted, fontSize: 15, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '800', fontFamily: 'Cairo_700Bold' },
});
