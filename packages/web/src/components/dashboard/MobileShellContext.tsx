'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'applymate:mobileNavVisible';

type MobileShellContextValue = {
  navVisible: boolean;
  toggleNav: () => void;
  setNavVisible: (visible: boolean) => void;
  navBottomOffset: string;
};

const MobileShellContext = createContext<MobileShellContextValue | null>(null);

export function MobileShellProvider({ children }: { children: ReactNode }) {
  const [navVisible, setNavVisibleState] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
        setNavVisibleState(true);
      }
    } catch {
      /* private mode */
    }
  }, []);

  const setNavVisible = useCallback((visible: boolean) => {
    setNavVisibleState(visible);
    try {
      sessionStorage.setItem(STORAGE_KEY, String(visible));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleNav = useCallback(() => {
    setNavVisibleState((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const navBottomOffset = navVisible
    ? 'calc(4.9rem + env(safe-area-inset-bottom, 0px))'
    : 'max(0.75rem, env(safe-area-inset-bottom, 0px))';

  const value = useMemo(
    () => ({ navVisible, toggleNav, setNavVisible, navBottomOffset }),
    [navVisible, toggleNav, setNavVisible, navBottomOffset],
  );

  return (
    <MobileShellContext.Provider value={value}>
      {children}
    </MobileShellContext.Provider>
  );
}

export function useMobileShell(): MobileShellContextValue {
  const ctx = useContext(MobileShellContext);
  if (!ctx) {
    return {
      navVisible: false,
      toggleNav: () => {},
      setNavVisible: () => {},
      navBottomOffset: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
    };
  }
  return ctx;
}
