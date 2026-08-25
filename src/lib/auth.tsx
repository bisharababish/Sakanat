import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { changeAppLanguage } from '@/src/i18n';
import { studentEmailError } from '@/src/lib/eduEmail';
import { AUTH_REDIRECT_URL, AUTH_RESET_URL, isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import type { Profile, UserRole } from '@/src/types/database';

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
  phone: string;
  role: Exclude<UserRole, 'admin'>;
  cityId?: string;
  universityId?: string;
  language: 'ar' | 'en';
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<'verify' | 'ready'>;
  verifyEmail: (email: string, token: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  passwordRecovery: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, cities(*), universities(*)')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const loadGen = useRef(0);

  const clearLocalAuth = () => {
    setSession(null);
    setProfile(null);
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
    const nextProfile = await fetchProfile(next.user.id);
    if (mine !== loadGen.current) return;
    if (!nextProfile) {
      await supabase.auth.signOut({ scope: 'local' });
      if (mine === loadGen.current) clearLocalAuth();
      return;
    }
    setSession(next);
    setProfile(nextProfile);
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
        if (input.role === 'student') {
          const emailIssue = studentEmailError(input.email);
          if (emailIssue) {
            throw new Error(emailIssue);
          }
        }
        const { data, error } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
            data: {
              full_name: input.fullName,
              phone: input.phone,
              role: input.role,
              city_id: input.cityId ?? '',
              university_id: input.universityId ?? '',
              language: input.language,
            },
          },
        });
        if (error) throw error;
        return data.session ? 'ready' : 'verify';
      },
      verifyEmail: async (email, token) => {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: 'signup',
        });
        if (error) throw error;
        await loadForSession(data.session);
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
        setProfile(next);
        return next;
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
    }),
    [session, profile, loading, passwordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
