import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CodeBoxes } from '@/components/ui/CodeBoxes';
import { SectionHead } from '@/components/profile/SectionHead';
import { useLayout } from '@/src/hooks/useLayout';
import { enrollTotp, formatTotpSecret, isMfaCooldown, listAllFactors, mfaCooldownMinutes, mfaCooldownRemainingMs, markMfaChanged, unenrollTotp, verifiedTotpFactor, verifyTotpCode } from '@/src/lib/mfa';
import { alert } from '@/src/lib/notice';
import { useColors } from '@/src/theme/ThemeProvider';

export function MfaSetup({ required = false, onEnabled }: { required?: boolean; onEnabled?: () => void }) {
  const { t } = useTranslation();
  const { rtlText } = useLayout();
  const colors = useColors();
  const [enabled, setEnabled] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [waitMinutes, setWaitMinutes] = useState(0);

  const refreshWait = useCallback(async () => {
    const remaining = await mfaCooldownRemainingMs();
    setWaitMinutes(remaining > 0 ? mfaCooldownMinutes(remaining) : 0);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const verified = await verifiedTotpFactor();
      setEnabled(Boolean(verified));
      setFactorId(verified?.id ?? '');
      if (verified) {
        setSecret('');
        setUri('');
        setCode('');
      }
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
      void refreshWait();
    }
  }, [refreshWait]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (required && enabled && !secret) onEnabled?.();
  }, [required, enabled, secret, onEnabled]);

  useEffect(() => {
    if (waitMinutes <= 0) return;
    const timer = setInterval(() => {
      void refreshWait();
    }, 15_000);
    return () => clearInterval(timer);
  }, [waitMinutes, refreshWait]);

  const startEnroll = async () => {
    setBusy(true);
    try {
      const data = await enrollTotp();
      setFactorId(data.id);
      setSecret(data.totp.secret);
      setUri(data.totp.uri);
      setCode('');
      setCopied(false);
    } catch (err) {
      if (isMfaCooldown(err)) {
        const minutes = mfaCooldownMinutes(err.remainingMs ?? 0);
        setWaitMinutes(minutes);
        alert(t('mfa.title'), t('mfa.cooldown', { minutes }));
        return;
      }
      alert(t('common.error'), t('mfa.unavailable'));
    } finally {
      setBusy(false);
      void refreshWait();
    }
  };

  const confirmEnroll = async () => {
    if (!factorId || code.replace(/\s/g, '').length < 6) {
      alert(t('common.error'), t('mfa.codeHint'));
      return;
    }
    setBusy(true);
    try {
      await verifyTotpCode(factorId, code);
      await markMfaChanged();
      alert(t('common.done'), t('mfa.enabled'));
      await refresh();
      onEnabled?.();
    } catch {
      alert(t('common.error'), t('mfa.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    setBusy(true);
    try {
      if (factorId) await unenrollTotp(factorId);
    } catch {
      // Unverified factor may already be gone.
    } finally {
      setFactorId('');
      setSecret('');
      setUri('');
      setCode('');
      setCopied(false);
      setBusy(false);
      void refresh();
    }
  };

  const disable = () => {
    alert(t('mfa.disableTitle'), t('mfa.disableBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mfa.disable'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const remaining = await mfaCooldownRemainingMs();
            if (remaining > 0) {
              const minutes = mfaCooldownMinutes(remaining);
              setWaitMinutes(minutes);
              alert(t('mfa.title'), t('mfa.cooldown', { minutes }));
              return;
            }
            const verified = await verifiedTotpFactor();
            if (verified) await unenrollTotp(verified.id);
            const leftover = await listAllFactors();
            for (const factor of leftover) {
              if (factor.factor_type === 'totp' && factor.status !== 'verified') await unenrollTotp(factor.id);
            }
            await markMfaChanged();
            alert(t('common.done'), t('mfa.disabled'));
            await refresh();
          } catch {
            alert(t('common.error'), t('mfa.disableFailed'));
          } finally {
            setBusy(false);
            void refreshWait();
          }
        },
      },
    ]);
  };

  const copySecret = async () => {
    if (!secret) return;
    await Clipboard.setStringAsync(secret);
    setCopied(true);
  };

  return (
    <Card>
      <SectionHead icon="shield-checkmark-outline" title={t('mfa.title')} />
      <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>
        {t(required ? 'mfa.adminRequired' : 'mfa.hint')}
      </Text>
      {loading ? null : enabled && !secret ? (
        <>
          <Text style={[styles.on, rtlText, { color: colors.primary }]}>{t('mfa.on')}</Text>
          <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('mfa.recoverHint')}</Text>
          {waitMinutes > 0 ? (
            <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>
              {t('mfa.cooldown', { minutes: waitMinutes })}
            </Text>
          ) : null}
          {required ? null : (
            <Button title={t('mfa.disable')} variant="danger" onPress={disable} loading={busy} disabled={waitMinutes > 0} pill />
          )}
        </>
      ) : secret ? (
        <>
          <Text style={[styles.body, rtlText, { color: colors.text }]}>{t('mfa.scanHint')}</Text>
          <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>{t('mfa.keepKey')}</Text>
          <Text style={[styles.secretLabel, rtlText, { color: colors.text }]}>{t('mfa.secret')}</Text>
          <View style={[styles.secretBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text selectable style={[styles.secret, { color: colors.text }]}>
              {formatTotpSecret(secret)}
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title={copied ? t('common.copied') : t('common.copy')} variant="secondary" onPress={() => void copySecret()} pill />
            </View>
            <View style={styles.flex}>
              <Button title={t('mfa.openApp')} variant="secondary" onPress={() => uri && void Linking.openURL(uri)} pill />
            </View>
          </View>
          <CodeBoxes label={t('mfa.code')} value={code} onChangeText={setCode} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title={t('common.cancel')} variant="ghost" onPress={() => void cancelEnroll()} pill />
            </View>
            <View style={styles.flex}>
              <Button title={t('mfa.confirm')} onPress={() => void confirmEnroll()} loading={busy} pill />
            </View>
          </View>
        </>
      ) : (
        <>
          <Button
            title={t('mfa.enable')}
            onPress={() => void startEnroll()}
            loading={busy}
            disabled={waitMinutes > 0}
            pill
          />
          {waitMinutes > 0 ? (
            <Text style={[styles.body, rtlText, { color: colors.textMuted }]}>
              {t('mfa.cooldown', { minutes: waitMinutes })}
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo_400Regular' },
  on: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  secretLabel: { fontWeight: '700', fontSize: 14, fontFamily: 'Cairo_700Bold' },
  secretBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    direction: 'ltr',
  },
  secret: {
    fontSize: 18,
    lineHeight: 30,
    letterSpacing: 1.5,
    textAlign: 'center',
    fontFamily: 'Cairo_700Bold',
    writingDirection: 'ltr',
  },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
