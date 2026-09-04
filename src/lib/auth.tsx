import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { changeAppLanguage } from '@/src/i18n';
import { isValidEmail, studentEmailError } from '@/src/lib/eduEmail';
import { isSuspended } from '@/src/lib/moderation';
import { mfaNeedsChallenge, verifiedTotpFactor, verifyTotpCode } from '@/src/lib/mfa';
import { AUTH_REDIRECT_URL, AUTH_RESET_URL, isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import type { PersonGender, Profile, PublicSignupRole } from '@/src/types/database';

function paramsFromAuthUrl(url: string) {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

async function applySessionFromUrl(url: string) {
  const params = paramsFromAuthUrl(url);
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return true;
  }
  return false;
}

type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  fullNameEn: string;
  phone: string;
  role: PublicSignupRole;
  cityId?: string;
  universityId?: string;
  universityDomains?: string[];
  gender?: PersonGender;
  language: 'ar' | 'en';
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<'verify' | 'ready'>;
  verifyEmail: (email: string, token: string) => Promise<Profile | null>;
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeMfa: (factorId: string, code: string) => Promise<void>;
  completeMfaEnroll: () => Promise<void>;
  passwordRecovery: boolean;
  mfaPending: boolean;
  mfaEnrollRequired: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function englishNameFromMeta(meta: unknown) {
  if (!meta || typeof meta !== 'object') return '';
  const value = (meta as { full_name_en?: unknown }).full_name_en;
  return typeof value === 'string' ? value : '';
}

function withEnglishName(profile: Profile, meta?: unknown): Profile {
  return { ...profile, full_name_en: englishNameFromMeta(meta) };
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, cities(*), universities(*)')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as Profile | null) ?? null;
}

async function fetchProfileWithRetry(userId: string) {
  for (let i = 0; i < 8; i++) {
    const row = await fetchProfile(userId);
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaEnrollRequired, setMfaEnrollRequired] = useState(false);
  const loadGen = useRef(0);

  const clearLocalAuth = () => {
    setSession(null);
    setProfile(null);
    setMfaPending(false);
    setMfaEnrollRequired(false);
  };

  const loadForSession = async (next: Session | null) => {
    const mine = ++loadGen.current;
    if (!next?.user) {
      if (mine === loadGen.current) clearLocalAuth();
      return;
    }
    try {
      await supabase.rpc('claim_admin');
    } catch {
      // Fine if the function is not installed yet.
    }
    const row = await fetchProfileWithRetry(next.user.id);
    const nextProfile = row ? withEnglishName(row, next.user.user_metadata) : null;
    if (mine !== loadGen.current) return;
    if (!nextProfile) {
      if (mine === loadGen.current) {
        setSession(next);
        setProfile(null);
      }
      return;
    }
    if (isSuspended(nextProfile)) {
      await supabase.auth.signOut({ scope: 'local' });
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch {
        // Local sign-out is enough.
      }
      if (mine === loadGen.current) clearLocalAuth();
      throw new Error('accountSuspended');
    }
    const metaGender = next.user.user_metadata?.gender;
    if (!nextProfile.gender && (metaGender === 'male' || metaGender === 'female')) {
      await supabase.from('profiles').update({ gender: metaGender }).eq('id', nextProfile.id);
      nextProfile.gender = metaGender;
    }
    const needsMfa = await mfaNeedsChallenge();
    const totp = needsMfa ? true : Boolean(await verifiedTotpFactor());
    if (mine !== loadGen.current) return;
    setSession(next);
    setProfile(nextProfile);
    setMfaPending(needsMfa);
    setMfaEnrollRequired(nextProfile.role === 'admin' && !needsMfa && !totp);
    if (nextProfile.language) {
      await changeAppLanguage(nextProfile.language);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      try {
        await loadForSession(data.session);
      } catch {
        clearLocalAuth();
      } finally {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setTimeout(() => router.replace('/(auth)/reset-password'), 0);
      }
      setTimeout(() => {
        void loadForSession(next).catch(() => {
          clearLocalAuth();
        });
      }, 0);
    });

    const handleUrl = (url: string | null) => {
      if (!url) return;
      const recovery = url.includes('reset-password') || url.includes('recovery') || url.includes('type=recovery');
      void applySessionFromUrl(url)
        .then((applied) => {
          if (!applied) return;
          if (recovery) {
            setPasswordRecovery(true);
            router.replace('/(auth)/reset-password');
            return;
          }
        })
        .catch(() => {
          // Invalid or already-used link; the confirmed screen still explains next steps.
        });
    };

    void Linking.getInitialURL().then(handleUrl);
    const linking = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      mounted = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
      linking.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      configured: isSupabaseConfigured,
      passwordRecovery,
      mfaPending,
      mfaEnrollRequired,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          const wrapped = new Error(error.message);
          (wrapped as { code?: string }).code = error.code;
          throw wrapped;
        }
        await loadForSession(data.session);
      },
      signUp: async (input) => {
        const role: PublicSignupRole = input.role === 'renter' ? 'renter' : 'student';
        if (role === 'student') {
          let domains = input.universityDomains ?? [];
          if (input.universityId) {
            const { data } = await supabase
              .from('universities')
              .select('email_domains')
              .eq('id', input.universityId)
              .maybeSingle();
            if (data?.email_domains?.length) domains = data.email_domains as string[];
          }
          const emailIssue = studentEmailError(input.email, domains);
          if (emailIssue) throw new Error(emailIssue);
        } else if (!isValidEmail(input.email)) {
          throw new Error('invalidEmail');
        }
        const { data, error } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
            data: {
              full_name: input.fullName,
              full_name_en: input.fullNameEn,
              phone: input.phone,
              role,
              city_id: input.cityId ?? '',
              university_id: role === 'student' ? (input.universityId ?? '') : '',
              gender: input.gender ?? '',
              language: input.language,
              accepted_terms_at: new Date().toISOString(),
            },
          },
        });
        if (error) throw error;
        return data.session ? 'ready' : 'verify';
      },
      verifyEmail: async (email, token) => {
        const cleanEmail = email.trim();
        const cleanToken = token.replace(/\s/g, '');
        let result = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'signup',
        });
        if (result.error) {
          result = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: 'email',
          });
        }
        if (result.error) throw result.error;
        await loadForSession(result.data.session);
        if (result.data.session?.user.id) {
          const row = await fetchProfileWithRetry(result.data.session.user.id);
          if (row) return withEnglishName(row, result.data.session.user.user_metadata);
        }
        return (await fetchProfile(result.data.session?.user.id ?? '')) ?? null;
      },
      resendConfirmation: async (email) => {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error) throw error;
      },
      signOut: async () => {
        setPasswordRecovery(false);
        await supabase.auth.signOut({ scope: 'local' });
        try {
          await supabase.auth.signOut({ scope: 'global' });
        } catch {
          // Local sign-out is enough to leave the app.
        }
      },
      refreshProfile: async () => {
        if (!session?.user) return null;
        const next = await fetchProfile(session.user.id);
        if (!next) {
          setProfile(null);
          return null;
        }
        const { data } = await supabase.auth.getUser();
        const merged = withEnglishName(next, data.user?.user_metadata);
        setProfile(merged);
        return merged;
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: AUTH_RESET_URL,
        });
        if (error) throw error;
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPasswordRecovery(false);
      },
      completeMfa: async (factorId, code) => {
        await verifyTotpCode(factorId, code);
        setMfaPending(false);
        const { data } = await supabase.auth.getSession();
        await loadForSession(data.session);
      },
      completeMfaEnroll: async () => {
        setMfaEnrollRequired(false);
        const { data } = await supabase.auth.getSession();
        await loadForSession(data.session);
      },
    }),
    [session, profile, loading, passwordRecovery, mfaPending, mfaEnrollRequired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
