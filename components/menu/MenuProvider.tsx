import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AppMenu } from '@/components/menu/AppMenu';
import { useAuth } from '@/src/lib/auth';

type MenuContextValue = {
  open: () => void;
  close: () => void;
};

const MenuContext = createContext<MenuContextValue>({ open: () => {}, close: () => {} });

export function MenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const { session, profile } = useAuth();
  const signedIn = Boolean(session && profile);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  useEffect(() => {
    if (!signedIn) close();
  }, [close, signedIn]);

  return (
    <MenuContext.Provider value={value}>
      {children}
      <AppMenu key={profile?.id ?? 'guest'} visible={visible} onClose={close} />
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
