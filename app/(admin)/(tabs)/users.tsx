import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLayout } from '@/src/hooks/useLayout';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/theme/colors';
import type { OwnerStatus, Profile, UserRole } from '@/src/types/database';

export default function AdminUsers() {
  const { t } = useTranslation();
  const { textAlign, row } = useLayout();
  const [users, setUsers] = useState<Profile[]>([]);
  const [role, setRole] = useState<UserRole | 'all'>('all');

  const load = useCallback(async () => {
    const query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data } = await query;
    setUsers((data as Profile[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setOwnerStatus = async (id: string, owner_status: OwnerStatus) => {
    const { error } = await supabase.from('profiles').update({ owner_status }).eq('id', id);
    if (error) Alert.alert(t('common.error'), error.message);
    else void load();
  };

  const visible = users.filter((user) => role === 'all' || user.role === role);

  return (
    <Screen>
      <Text style={[styles.title, { textAlign }]}>{t('admin.users')}</Text>
      <View style={[styles.row, row]}>
        <Chip label={t('common.all')} selected={role === 'all'} onPress={() => setRole('all')} />
        <Chip label={t('roles.student')} selected={role === 'student'} onPress={() => setRole('student')} />
        <Chip label={t('roles.owner')} selected={role === 'owner'} onPress={() => setRole('owner')} />
        <Chip label={t('roles.admin')} selected={role === 'admin'} onPress={() => setRole('admin')} />
      </View>
      {visible.length === 0 ? <EmptyState title={t('admin.noPending')} /> : null}
      {visible.map((user) => (
        <Card key={user.id}>
          <Text style={[styles.name, { textAlign }]}>{user.full_name || user.email}</Text>
          <Text style={[styles.meta, { textAlign }]}>{user.email}</Text>
          <Text style={[styles.meta, { textAlign }]}>{t(`roles.${user.role}`)}</Text>
          {user.role === 'owner' ? (
            <StatusBadge
              label={t(`status.${user.owner_status}`)}
              tone={user.owner_status === 'approved' ? 'approved' : user.owner_status === 'rejected' ? 'rejected' : 'pending'}
            />
          ) : null}
          {user.role === 'owner' && user.owner_status === 'pending' ? (
            <View style={[styles.row, row]}>
              <View style={styles.flex}>
                <Button title={t('admin.approve')} onPress={() => setOwnerStatus(user.id, 'approved')} />
              </View>
              <View style={styles.flex}>
                <Button title={t('admin.reject')} variant="danger" onPress={() => setOwnerStatus(user.id, 'rejected')} />
              </View>
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  row: { flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { color: colors.textMuted },
  flex: { flex: 1 },
});
