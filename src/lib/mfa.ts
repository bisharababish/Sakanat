import { supabase } from '@/src/lib/supabase';

export const MFA_ISSUER = 'بدك سكن؟ اطلب منا';
export const MFA_COOLDOWN_MS = 10 * 60 * 1000;
const MFA_CHANGED_AT = 'mfa_changed_at';

export class MfaCooldownError extends Error {
  remainingMs: number;
  constructor(remainingMs: number) {
    super('mfaCooldown');
    this.name = 'MfaCooldownError';
    this.remainingMs = remainingMs;
  }
}

export function mfaCooldownMinutes(remainingMs: number) {
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

export async function mfaCooldownRemainingMs() {
  const { data } = await supabase.auth.getUser();
  const raw = data.user?.user_metadata?.[MFA_CHANGED_AT];
  const at = Date.parse(String(raw ?? ''));
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, at + MFA_COOLDOWN_MS - Date.now());
}

export function isMfaCooldown(err: unknown): err is MfaCooldownError {
  return err instanceof MfaCooldownError || (err instanceof Error && err.message === 'mfaCooldown');
}

export async function assertMfaCooldown() {
  const remainingMs = await mfaCooldownRemainingMs();
  if (remainingMs > 0) throw new MfaCooldownError(remainingMs);
}

export async function markMfaChanged() {
  try {
    await supabase.auth.updateUser({
      data: { [MFA_CHANGED_AT]: new Date().toISOString() },
    });
  } catch {
    // Cooldown is best-effort; turning authenticator on or off should still succeed.
  }
}

export async function mfaNeedsChallenge() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export async function listTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data?.totp ?? [];
}

export async function verifiedTotpFactor() {
  const factors = await listTotpFactors();
  return factors.find((item) => item.status === 'verified') ?? null;
}

export async function enrollTotp() {
  await assertMfaCooldown();
  const factors = await listTotpFactors();
  for (const factor of factors) {
    if (factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Google Authenticator',
    issuer: MFA_ISSUER,
  });
  if (error) throw error;
  if (!data || data.type !== 'totp' || !data.totp) throw new Error('mfaUnavailable');
  return data;
}

export async function verifyTotpCode(factorId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.replace(/\s/g, ''),
  });
  if (error) throw error;
  return data;
}

export async function unenrollTotp(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export function formatTotpSecret(secret: string) {
  return secret.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

