import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MfaSetup } from '@/components/auth/MfaSetup';
import { PasswordChecks } from '@/components/auth/PasswordChecks';
import { SessionSecurity } from '@/components/auth/SessionSecurity';
import { SectionHead } from '@/components/profile/SectionHead';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useLayout } from '@/src/hooks/useLayout';
import { useAuth } from '@/src/lib/auth';
import { alert } from '@/src/lib/notice';
import { isPasswordValid } from '@/src/lib/password';
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
  const { profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

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

  return (
    <>
      <Card>
        <SectionHead icon="lock-closed-outline" title={t('profile.passwordTitle')} />
        <Input
          label={t('profile.currentPassword')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Input
          label={t('profile.newPassword')}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Input
          label={t('profile.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <PasswordChecks password={newPassword} confirm={confirmPassword} />
        <Button title={t('profile.changePassword')} onPress={changePassword} loading={updatingPassword} pill />
      </Card>
      <MfaSetup required={mfaRequired} />
      <SessionSecurity />
      {onDelete ? (
        <Card>
          <SectionHead icon="trash-outline" title={t('profile.deleteAccount')} />
          <Text style={[styles.hint, rtlText, { color: colors.textMuted }]}>{t('profile.deleteAccountHint')}</Text>
          <Button
            title={t('profile.deleteAccount')}
            variant="danger"
            onPress={onDelete}
            loading={deleting}
            pill
          />
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14, lineHeight: 22, textAlign: 'center', fontFamily: 'Cairo_400Regular' },
});
