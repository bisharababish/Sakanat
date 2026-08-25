import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { isValidEmail, sanitizeEmail } from '@/src/lib/eduEmail';
import { localizedName } from '@/src/lib/format';
import { alert } from '@/src/lib/notice';
import { toE164, whatsappLink, type PhoneRegion } from '@/src/lib/phone';
import { AUTH_REDIRECT_URL, createDetachedClient, supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { OwnerStatus, Profile, UserRole } from '@/src/types/database';

type RoleFilter = UserRole | 'all';
type OwnerFilter = OwnerStatus | 'all';

export default function AdminUsers() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart } = useLayout();
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [role, setRole] = useState<RoleFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [query, setQuery] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, cities(*), universities(*)')
      .order('created_at', { ascending: false });
    setUsers((data as Profile[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setOwnerStatus = async (id: string, owner_status: OwnerStatus) => {
    const { error } = await supabase.from('profiles').update({ owner_status }).eq('id', id);
    if (error) {
      alert(t('common.error'), error.message);
      return;
    }
    if (owner_status === 'rejected') {
      await supabase.from('apartments').update({ status: 'rejected' }).eq('owner_id', id);
    }
    void load();
  };

  const suspend = (user: Profile) => {
    alert(t('admin.suspend'), t('admin.confirmSuspend'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.suspend'),
        style: 'destructive',
        onPress: () => void setOwnerStatus(user.id, 'rejected'),
      },
    ]);
  };

  const createOwner = async () => {
    const cleanEmail = sanitizeEmail(email);
    if (!fullName.trim() || !cleanEmail || !password) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      alert(t('common.error'), t('auth.invalidEmail'));
      return;
    }
    if (password.length < 6) {
      alert(t('common.error'), t('auth.weakPassword'));
      return;
    }
    const cleanPhone = phoneLocal.trim() ? toE164(phoneRegion, phoneLocal) : '';
    if (phoneLocal.trim() && !cleanPhone) {
      alert(t('common.error'), t('phone.invalid'));
      return;
    }
    setCreating(true);
    try {
      const client = createDetachedClient();
      const { data, error } = await client.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
          data: {
            full_name: fullName.trim(),
            phone: cleanPhone,
            role: 'owner',
            language: 'ar',
          },
        },
      });
      if (error) throw error;
      if (data.user?.id) {
        await supabase
          .from('profiles')
          .update({
            role: 'owner',
            owner_status: 'approved',
            full_name: fullName.trim(),
            phone: cleanPhone,
            email: cleanEmail,
          })
          .eq('id', data.user.id);
      }
      alert(t('common.done'), t('admin.ownerCreated'));
      setFullName('');
      setEmail('');
      setPhoneLocal('');
      setPassword('');
      void load();
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setCreating(false);
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (role !== 'all' && user.role !== role) return false;
      if (role === 'owner' && ownerFilter !== 'all' && user.owner_status !== ownerFilter) return false;
      if (!needle) return true;
      const hay = [user.full_name, user.email, user.phone, user.whatsapp, user.student_id_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [users, role, ownerFilter, query]);

  const ownerTone = (status: OwnerStatus) =>
    status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';

  const ownerLabel = (status: OwnerStatus) =>
    status === 'approved' ? t('admin.ownerActive') : status === 'rejected' ? t('admin.ownerSuspended') : t('admin.ownerWaiting');

  return (
    <Screen>
      <Text style={[styles.title, rtlText]}>{t('admin.users')}</Text>
      <Card>
        <Text style={[styles.formTitle, rtlText]}>{t('admin.createOwner')}</Text>
        <Input label={t('common.name')} value={fullName} onChangeText={setFullName} />
        <Input
          label={t('common.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          ltr
        />
        <PhoneField
          label={t('common.phone')}
          region={phoneRegion}
          local={phoneLocal}
          onRegionChange={setPhoneRegion}
          onLocalChange={setPhoneLocal}
        />
        <Input label={t('common.password')} value={password} onChangeText={setPassword} secureTextEntry />
        <Button title={t('admin.createOwner')} onPress={createOwner} loading={creating} />
      </Card>
      <Input label={t('admin.searchUsers')} value={query} onChangeText={setQuery} />
      <View style={[styles.chips, { justifyContent: alignStart }]}>
        <Chip label={t('common.all')} selected={role === 'all'} onPress={() => setRole('all')} />
        <Chip label={t('roles.student')} selected={role === 'student'} onPress={() => setRole('student')} />
        <Chip label={t('roles.owner')} selected={role === 'owner'} onPress={() => setRole('owner')} />
        <Chip label={t('roles.admin')} selected={role === 'admin'} onPress={() => setRole('admin')} />
      </View>
      {role === 'owner' ? (
        <View style={[styles.chips, { justifyContent: alignStart }]}>
          <Chip label={t('common.all')} selected={ownerFilter === 'all'} onPress={() => setOwnerFilter('all')} />
          <Chip label={t('admin.ownerWaiting')} selected={ownerFilter === 'pending'} onPress={() => setOwnerFilter('pending')} />
          <Chip label={t('admin.ownerActive')} selected={ownerFilter === 'approved'} onPress={() => setOwnerFilter('approved')} />
          <Chip label={t('admin.ownerSuspended')} selected={ownerFilter === 'rejected'} onPress={() => setOwnerFilter('rejected')} />
        </View>
      ) : null}
      {visible.length === 0 ? <EmptyState title={t('admin.noUsers')} /> : null}
      {visible.map((user) => {
        const phone = user.phone;
        const whatsapp = user.whatsapp || phone;
        const city = localizedName(user.cities, i18n.language);
        const university = localizedName(user.universities, i18n.language);
        return (
          <Card key={user.id} onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: user.id } })}>
            <Text style={[styles.name, rtlText]}>{user.full_name || user.email}</Text>
            <Text style={[styles.meta, rtlText]}>{user.email}</Text>
            {phone ? <Text style={[styles.meta, rtlText]}>{phone}</Text> : null}
            <Text style={[styles.meta, rtlText]}>{t(`roles.${user.role}`)}</Text>
            {city || university ? (
              <Text style={[styles.meta, rtlText]}>{[city, university].filter(Boolean).join(' · ')}</Text>
            ) : null}
            {user.role === 'student' && user.student_id_number ? (
              <Text style={[styles.meta, rtlText]}>
                {t('profile.studentId')}: {user.student_id_number}
              </Text>
            ) : null}
            {user.role === 'owner' ? <StatusBadge label={ownerLabel(user.owner_status)} tone={ownerTone(user.owner_status)} /> : null}
            <Button
              title={t('admin.editUser')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: user.id } })}
            />
            {user.role === 'owner' && user.id !== profile?.id ? (
              <View style={[styles.row, { justifyContent: alignStart }]}>
                {user.owner_status !== 'approved' ? (
                  <View style={styles.flex}>
                    <Button title={t('admin.approveAlways')} onPress={() => void setOwnerStatus(user.id, 'approved')} />
                  </View>
                ) : (
                  <View style={styles.flex}>
                    <Button title={t('admin.suspend')} variant="danger" onPress={() => suspend(user)} />
                  </View>
                )}
              </View>
            ) : null}
            {phone ? <Button title={t('common.call')} variant="ghost" onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
            {whatsapp ? (
              <Button title={t('profile.openWhatsapp')} variant="ghost" onPress={() => Linking.openURL(whatsappLink(whatsapp))} />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  formTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { color: colors.textMuted },
  flex: { flex: 1 },
});
