import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BlockedUsersCard } from '@/components/profile/BlockedUsersCard';
import { UserDataExport } from '@/components/profile/UserDataExport';
import { MfaSetup } from '@/components/auth/MfaSetup';
import { PasswordChecks } from '@/components/auth/PasswordChecks';
import { SessionSecurity } from '@/components/auth/SessionSecurity';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PhoneField } from '@/components/ui/PhoneField';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { alert } from '@/src/lib/notice';
import { isPasswordValid } from '@/src/lib/password';
import { splitPhone, toE164, type PhoneRegion } from '@/src/lib/phone';
import { supabase } from '@/src/lib/supabase';
import { useColors } from '@/src/theme/ThemeProvider';

type Props = {
  mfaRequired?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
};

export function ProfileSecurity({ mfaRequired, onDelete, deleting }: Props) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const { profile, refreshProfile, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const recovery = splitPhone(profile?.recovery_phone);
  const [recoveryEmail, setRecoveryEmail] = useState(profile?.recovery_email ?? '');
  const [recoveryRegion, setRecoveryRegion] = useState<PhoneRegion>(recovery.region);
  const [recoveryLocal, setRecoveryLocal] = useState(recovery.local);
  const [savingRecovery, setSavingRecovery] = useState(false);

  const changePassword = async () => {
    if (!profile?.email || !currentPassword || !newPassword) {
      alert(t('common.error'), t('auth.missingFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      alert(t('common.error'), t('profile.passwordMismatch'));
      return;
    }
    if (!isPasswordValid(newPassword, confirmPassword)) {
      alert(t('common.error'), t('auth.weakPassword'));
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error: checkError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (checkError) throw checkError;
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert(t('common.done'), t('profile.passwordChanged'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const saveRecovery = async () => {
    if (!profile) return;
    const email = recoveryEmail.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert(t('common.error'), t('profile.recoveryEmailInvalid'));
      return;
    }
    if (email && email === profile.email.trim().toLowerCase()) {
      alert(t('common.error'), t('profile.recoveryEmailSame'));
      return;
    }
    const phone = recoveryLocal.trim() ? toE164(recoveryRegion, recoveryLocal) : null;
    if (recoveryLocal.trim() && !phone) {
      alert(t('common.error'), t('profile.recoveryPhoneInvalid'));
      return;
    }
    setSavingRecovery(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          recovery_email: email || null,
          recovery_phone: phone,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      alert(t('common.done'), t('profile.recoverySaved'));
    } catch (err) {
      alert(t('common.error'), err instanceof Error ? err.message : '');
    } finally {
      setSavingRecovery(false);
    }
  };

  return (
    <>
      <Card compact>
        <SectionHead compact icon="lock-closed-outline" title={t('profile.passwordTitle')} />
        <Input
          compact
          label={t('profile.currentPassword')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Input
          compact
          label={t('profile.newPassword')}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Input
          compact
          label={t('profile.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <PasswordChecks password={newPassword} confirm={confirmPassword} />
        <Button title={t('profile.changePassword')} onPress={changePassword} loading={updatingPassword} pill />
      </Card>
      <MfaSetup
        required={mfaRequired}
        requiredRole={profile?.role === 'owner' ? 'owner' : 'admin'}
      />
      {profile?.id ? <SessionSecurity userId={profile.id} /> : null}
      <Card compact>
        <SectionHead compact icon="key-outline" title={t('profile.recoveryTitle')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.recoveryHint')}</Text>
        <Input
          compact
          label={t('profile.recoveryEmail')}
          value={recoveryEmail}
          onChangeText={setRecoveryEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          ltr
        />
        <PhoneField
          compact
          label={t('profile.recoveryPhone')}
          region={recoveryRegion}
          local={recoveryLocal}
          onRegionChange={setRecoveryRegion}
          onLocalChange={setRecoveryLocal}
        />
        <Button title={t('profile.saveRecovery')} onPress={() => void saveRecovery()} loading={savingRecovery} pill />
      </Card>
      {profile?.id ? <BlockedUsersCard userId={profile.id} /> : null}
      {profile?.id ? <UserDataExport userId={profile.id} compact /> : null}
      {profile?.last_seen_ip && !profile.hide_last_seen ? (
        <Card compact>
          <SectionHead compact icon="globe-outline" title={t('profile.deviceIp')} />
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.deviceIpHint')}</Text>
          <Text style={[styles.hint, rtlText, { color: colors.text }]}>{profile.last_seen_ip}</Text>
        </Card>
      ) : null}
      {onDelete ? (
        <Card compact>
          <SectionHead compact icon="trash-outline" title={t('profile.deleteAccount')} />
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>
            {t(profile?.role === 'owner' ? 'profile.deleteAccountHintOwner' : 'profile.deleteAccountHint')}
          </Text>
          <Button
            title={t('profile.deleteAccount')}
            variant="danger"
            onPress={onDelete}
            loading={deleting}
            pill
          />
        </Card>
      ) : null}
      <Card compact>
        <SectionHead compact icon="log-out-outline" title={t('common.logout')} />
        <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.logoutHint')}</Text>
        <Button
          title={t('common.logout')}
          variant="ghost"
          onPress={() =>
            alert(t('common.logout'), t('common.confirmLogout'), [
              { text: t('common.no'), style: 'cancel' },
              { text: t('common.yes'), style: 'destructive', onPress: () => void signOut() },
            ])
          }
          pill
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 18, fontFamily: 'Cairo_400Regular' },
});
