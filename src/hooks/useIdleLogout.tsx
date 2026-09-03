import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/src/lib/auth';
import { alert } from '@/src/lib/notice';

const IDLE_MS = 30 * 60 * 1000;
const BACKGROUND_MS = 15 * 60 * 1000;

export function IdleGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, signOut, passwordRecovery, mfaPending, mfaEnrollRequired } = useAuth();
  const lastTouch = useRef(Date.now());
  const backgroundedAt = useRef<number | null>(null);
  const signingOut = useRef(false);

  const locked = !session || passwordRecovery || mfaPending || mfaEnrollRequired;

  useEffect(() => {
    if (locked) {
      lastTouch.current = Date.now();
      backgroundedAt.current = null;
      signingOut.current = false;
      return;
    }

    const leave = async () => {
      if (signingOut.current) return;
      signingOut.current = true;
      await signOut();
      alert(t('auth.idleTitle'), t('auth.idleSignedOut'));
    };

    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        backgroundedAt.current = Date.now();
        return;
      }
      const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (away >= BACKGROUND_MS) {
        void leave();
        return;
      }
      lastTouch.current = Date.now();
    });

    const tick = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      if (Date.now() - lastTouch.current >= IDLE_MS) void leave();
    }, 15_000);

    return () => {
      app.remove();
      clearInterval(tick);
    };
  }, [locked, signOut, t]);

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={() => {
        lastTouch.current = Date.now();
      }}
    >
      {children}
    </View>
  );
}
