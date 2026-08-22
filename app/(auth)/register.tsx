import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Select } from '@/components/ui/Select';
import { useCatalog } from '@/src/hooks/useCatalog';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { localizedName } from '@/src/lib/format';
import { colors } from '@/src/theme/colors';
import type { UserRole } from '@/src/types/database';

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const { textAlign } = useLayout();
  const { signUp } = useAuth();
  const { cities, universities } = useCatalog();
  const [role, setRole] = useState<Exclude<UserRole, 'admin'>>('student');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
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
      universities
        .filter((item) => !cityId || item.city_id === cityId)
        .map((item) => ({ value: item.id, label: localizedName(item, lang) })),
    [universities, lang, cityId],
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
        phone,
        role,
        cityId,
        universityId,
        language: lang.startsWith('ar') ? 'ar' : 'en',
      });
      router.replace(result === 'verify' ? '/(auth)/verify-email' : '/');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      setError(message === 'studentEmailRequired' ? t('auth.studentEmailRequired') : message === 'invalidEmail' ? t('auth.invalidEmail') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('auth.register')}</Text>
      <Text style={[styles.subtitle, { textAlign }]}>{t('auth.chooseRole')}</Text>
      <View style={styles.roles}>
        <Card onPress={() => setRole('student')}>
          <Text style={[styles.roleTitle, role === 'student' && styles.picked, { textAlign }]}>{t('roles.student')}</Text>
          <Text style={[styles.hint, { textAlign }]}>{t('auth.studentHint')}</Text>
        </Card>
        <Card onPress={() => setRole('owner')}>
          <Text style={[styles.roleTitle, role === 'owner' && styles.picked, { textAlign }]}>{t('roles.owner')}</Text>
          <Text style={[styles.hint, { textAlign }]}>{t('auth.ownerHint')}</Text>
        </Card>
      </View>
      <Input label={t('common.name')} value={fullName} onChangeText={setFullName} />
      <Input label={t('common.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Input
        label={role === 'student' ? t('auth.studentEmail') : t('common.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        hint={role === 'student' ? t('auth.studentEmailHint') : undefined}
      />
      <Input label={t('common.password')} value={password} onChangeText={setPassword} secureTextEntry />
      <Select
        label={t('common.city')}
        value={cityId}
        placeholder={t('common.select')}
        options={cityOptions}
        onChange={(next) => {
          setCityId(next);
          setUniversityId('');
        }}
      />
      {role === 'student' ? (
        <Select
          label={t('common.university')}
          value={universityId}
          placeholder={t('common.select')}
          options={universityOptions}
          onChange={setUniversityId}
        />
      ) : null}
      {error ? <Text style={[styles.error, { textAlign }]}>{error}</Text> : null}
      <Button title={t('auth.register')} onPress={onSubmit} loading={loading} />
      <Link href="/(auth)/login" style={[styles.link, { textAlign }]}>
        {t('auth.hasAccount')} {t('auth.login')}
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 16, color: colors.textMuted },
  roles: { gap: 10 },
  roleTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  picked: { color: colors.primary },
  hint: { color: colors.textMuted },
  error: { color: colors.danger, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
