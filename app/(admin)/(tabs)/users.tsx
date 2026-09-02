import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { PasswordChecks } from '@/components/auth/PasswordChecks';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { Pager } from '@/components/ui/Pager';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { usePaged } from '@/src/hooks/usePaged';
import { useAuth } from '@/src/lib/auth';
import { isValidEmail, sanitizeEmail } from '@/src/lib/eduEmail';
import { localizedName } from '@/src/lib/format';
import { isSuspended, setSuspended } from '@/src/lib/moderation';
import { alert } from '@/src/lib/notice';
import { NAME_MAX, cleanName, isValidName, sanitizeNameInput } from '@/src/lib/name';
import { isPasswordValid } from '@/src/lib/password';
import { USER_PAGE_SIZE } from '@/src/lib/page';
import { toE164, whatsappLink, type PhoneRegion } from '@/src/lib/phone';
import { AUTH_REDIRECT_URL, createDetachedClient, supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';
import type { OwnerStatus, Profile, UserRole } from '@/src/types/database';

type RoleFilter = UserRole | 'all';
type OwnerFilter = OwnerStatus | 'all';

export default function AdminUsers() {
  const { t, i18n } = useTranslation();
  const { rtlText, alignStart, row } = useLayout();
  const colors = useColors();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ role?: string; owner?: string }>();
  const [users, setUsers] = useState<Profile[]>([]);
  const [role, setRole] = useState<RoleFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneRegion, setPhoneRegion] = useState<PhoneRegion>('ps');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  useEffect(() => {
    const nextRole = params.role;
    if (nextRole === 'student' || nextRole === 'renter' || nextRole === 'owner' || nextRole === 'admin' || nextRole === 'all') {
      setRole(nextRole);
    }
    const nextOwner = params.owner;
    if (nextOwner === 'pending' || nextOwner === 'approved' || nextOwner === 'rejected' || nextOwner === 'all') {
      setOwnerFilter(nextOwner);
    }
  }, [params.role, params.owner]);

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

  const toggleSuspend = (user: Profile) => {
    const next = !isSuspended(user);
    alert(
      next ? t('admin.suspend') : t('admin.restoreAccount'),
      next ? t('admin.confirmSuspend') : t('admin.confirmRestore'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: next ? t('admin.suspend') : t('admin.restoreAccount'),
          style: next ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await setSuspended(user, next);
              void load();
            } catch (err) {
              alert(t('common.error'), err instanceof Error ? err.message : '');
            }
          },
        },
      ],
    );
  };

  const createOwner = async () => {
    const cleanEmail = sanitizeEmail(email);
    if (!fullName.trim() || !cleanEmail || !password) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    if (!isValidName(fullName)) {
      alert(t('common.error'), t('auth.invalidName'));
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      alert(t('common.error'), t('auth.invalidEmail'));
      return;
    }
    if (!isPasswordValid(password, confirmPassword)) {
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
            full_name: cleanName(fullName),
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
            full_name: cleanName(fullName),
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
      setConfirmPassword('');
      setCreateOpen(false);
      setRole('owner');
      setOwnerFilter('approved');
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
  const paged = usePaged(visible, USER_PAGE_SIZE, `${role}|${ownerFilter}|${query}`);
  const roleCounts = useMemo(() => {
    const next = { all: users.length, student: 0, renter: 0, owner: 0, admin: 0 };
    for (const user of users) next[user.role] += 1;
    return next;
  }, [users]);
  const ownerCounts = useMemo(() => {
    const owners = users.filter((user) => user.role === 'owner');
    const next: Record<OwnerFilter, number> = {
      all: owners.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const user of owners) next[user.owner_status] += 1;
    return next;
  }, [users]);

  const ownerTone = (status: OwnerStatus) =>
    status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';

  const ownerLabel = (status: OwnerStatus) =>
    status === 'approved' ? t('admin.ownerActive') : status === 'rejected' ? t('admin.ownerSuspended') : t('admin.ownerWaiting');

  return (
    <Screen>
      <Text style={[styles.kicker, rtlText, { color: colors.accent }]}>{t('tabs.users')}</Text>
      <Text style={[styles.title, rtlText, { color: colors.text }]}>{t('admin.users')}</Text>
      <Card>
        <Pressable
          onPress={() => setCreateOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={t('admin.createOwner')}
          style={[styles.createHead, row]}
        >
          <View style={styles.createCopy}>
            <Text style={[styles.formTitle, rtlText, { color: colors.text }]}>{t('admin.createOwner')}</Text>
            {!createOpen ? (
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t('admin.createOwnerHint')}</Text>
            ) : null}
          </View>
          <Ionicons name={createOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </Pressable>
        {createOpen ? (
          <>
            <Input
              label={t('common.name')}
              value={fullName}
              onChangeText={(value) => setFullName(sanitizeNameInput(value))}
              hint={t('profile.nameHint')}
              autoCapitalize="words"
              maxLength={NAME_MAX}
            />
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
            <Input label={t('admin.createOwnerPassword')} value={password} onChangeText={setPassword} secureTextEntry />
            <Input
              label={t('admin.confirmOwnerPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <PasswordChecks password={password} confirm={confirmPassword} />
            <Button title={t('admin.createOwner')} onPress={createOwner} loading={creating} pill />
          </>
        ) : null}
      </Card>
      <Input label={t('admin.searchUsers')} value={query} onChangeText={setQuery} />
      <FilterPills
        value={role}
        onChange={setRole}
        items={[
          { value: 'all', label: t('common.all'), count: roleCounts.all },
          { value: 'student', label: t('roles.student'), count: roleCounts.student },
          { value: 'renter', label: t('roles.renter'), count: roleCounts.renter },
          { value: 'owner', label: t('roles.owner'), count: roleCounts.owner },
          { value: 'admin', label: t('roles.admin'), count: roleCounts.admin },
        ]}
      />
      {role === 'owner' ? (
        <FilterPills
          value={ownerFilter}
          onChange={setOwnerFilter}
          items={[
            { value: 'all', label: t('common.all'), count: ownerCounts.all },
            { value: 'pending', label: t('admin.ownerWaiting'), count: ownerCounts.pending },
            { value: 'approved', label: t('admin.ownerActive'), count: ownerCounts.approved },
            { value: 'rejected', label: t('admin.ownerSuspended'), count: ownerCounts.rejected },
          ]}
        />
      ) : null}
      {visible.length === 0 ? <EmptyState title={t('admin.noUsers')} /> : null}
      {paged.slice.map((user) => {
        const phone = user.phone;
        const whatsapp = user.whatsapp || phone;
        const city = localizedName(user.cities, i18n.language);
        const university = localizedName(user.universities, i18n.language);
        return (
          <Card key={user.id} onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: user.id } })}>
            <Text style={[styles.name, rtlText, { color: colors.text }]}>{user.full_name || user.email}</Text>
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{user.email}</Text>
            {phone ? <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{phone}</Text> : null}
            <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{t(`roles.${user.role}`)}</Text>
            {city || university ? (
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>{[city, university].filter(Boolean).join(' · ')}</Text>
            ) : null}
            {user.role === 'student' && user.student_id_number ? (
              <Text style={[styles.meta, rtlText, { color: colors.textMuted }]}>
                {t('profile.studentId')}: {user.student_id_number}
              </Text>
            ) : null}
            {isSuspended(user) ? (
              <StatusBadge label={t('admin.accountSuspended')} tone="rejected" />
            ) : user.role === 'owner' ? (
              <StatusBadge label={ownerLabel(user.owner_status)} tone={ownerTone(user.owner_status)} />
            ) : null}
            <Button
              title={t('admin.editUser')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/(admin)/user/[id]', params: { id: user.id } })}
            />
            {user.role !== 'admin' && user.id !== profile?.id ? (
              <View style={[styles.row, { justifyContent: alignStart }]}>
                {user.role === 'owner' && user.owner_status !== 'approved' && !isSuspended(user) ? (
                  <View style={styles.flex}>
                    <Button title={t('admin.approveAlways')} onPress={() => void setOwnerStatus(user.id, 'approved')} />
                  </View>
                ) : (
                  <View style={styles.flex}>
                    <Button
                      title={isSuspended(user) ? t('admin.restoreAccount') : t('admin.suspend')}
                      variant={isSuspended(user) ? 'secondary' : 'danger'}
                      onPress={() => toggleSuspend(user)}
                    />
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
      <Pager
        page={paged.page}
        pages={paged.pages}
        from={paged.from}
        to={paged.to}
        total={paged.total}
        pageSize={paged.pageSize}
        onPage={paged.setPage}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 12, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  formTitle: { fontSize: 17, fontWeight: '800', fontFamily: 'Cairo_800ExtraBold' },
  createHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  createCopy: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: 'row', gap: 8 },
  name: { fontSize: 17, fontWeight: '800' },
  meta: {},
  flex: { flex: 1 },
});
