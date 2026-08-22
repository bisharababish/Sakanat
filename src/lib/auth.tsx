import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { changeAppLanguage } from '@/src/i18n';
import { studentEmailError } from '@/src/lib/eduEmail';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import type { Profile, UserRole } from '@/src/types/database';

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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, cities(*), universities(*)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadForSession = async (next: Session | null) => {
    setSession(next);
    if (!next?.user) {
      setProfile(null);
      return;
    }
    const nextProfile = await fetchProfile(next.user.id);
    setProfile(nextProfile);
    if (nextProfile?.language) {
      await changeAppLanguage(nextProfile.language);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      try {
        await loadForSession(data.session);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void loadForSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      configured: isSupabaseConfigured,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
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
            emailRedirectTo: Linking.createURL('/'),
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
      signOut: async () => {
        setSession(null);
        setProfile(null);
        await supabase.auth.signOut({ scope: 'local' });
        try {
          await supabase.auth.signOut({ scope: 'global' });
        } catch {
          // Local sign-out is enough to leave the app.
        }
        router.replace('/(auth)/welcome');
      },
      refreshProfile: async () => {
        if (!session?.user) return null;
        const next = await fetchProfile(session.user.id);
        setProfile(next);
        return next;
      },
    }),
    [session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
