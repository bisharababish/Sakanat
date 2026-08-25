import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { AppMenu } from '@/components/menu/AppMenu';

type MenuContextValue = {
  open: () => void;
  close: () => void;
};

const MenuContext = createContext<MenuContextValue>({ open: () => {}, close: () => {} });

export function MenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <MenuContext.Provider value={value}>
      {children}
      <AppMenu visible={visible} onClose={close} />
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
