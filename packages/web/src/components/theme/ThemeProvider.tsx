'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { api } from '@/lib/api';
import {
  applyResolvedTheme,
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  readStoredThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeStoredThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme/themePreference';
import { useAuthStore } from '@/store/useAuthStore';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  /** User choice: applies instantly and saves to the account when signed in. */
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function applyPreference(preference: ThemePreference) {
  applyResolvedTheme(resolveTheme(preference, systemPrefersDark()));
}

function setLocalPreference(preference: ThemePreference) {
  writeStoredThemePreference(preference);
  applyPreference(preference);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (readStoredThemePreference() === 'system') applyPreference('system');
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyPreference(readStoredThemePreference());
    listener();
  };
  media.addEventListener('change', onSystemChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
  };
}

const getServerPreference = () => DEFAULT_THEME_PREFERENCE;
const getServerSystemDark = () => false;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribe,
    readStoredThemePreference,
    getServerPreference,
  );
  const systemDark = useSyncExternalStore(
    subscribe,
    systemPrefersDark,
    getServerSystemDark,
  );

  const accountTheme = useAuthStore((s) => {
    const theme = s.user?.uiPrefs?.theme;
    return isThemePreference(theme) ? theme : null;
  });
  const lastAccountTheme = useRef<ThemePreference | null>(null);

  // The account wins when it changes (sign-in, another device), but a value
  // we already applied is never re-applied, so local choices don't bounce.
  useEffect(() => {
    if (!accountTheme) {
      lastAccountTheme.current = null;
      return;
    }
    if (accountTheme === lastAccountTheme.current) return;
    lastAccountTheme.current = accountTheme;
    if (accountTheme !== readStoredThemePreference()) {
      setLocalPreference(accountTheme);
    }
  }, [accountTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setLocalPreference(next);
    const { isAuthenticated, user, syncUserFromMe } = useAuthStore.getState();
    if (!isAuthenticated || !user) return;
    lastAccountTheme.current = next;
    syncUserFromMe({
      ...user,
      uiPrefs: { ...(user.uiPrefs ?? {}), theme: next },
    });
    // Saved locally either way; the next change retries the account save.
    void api.users.updateMe({ uiPrefs: { theme: next } }).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme: resolveTheme(preference, systemDark),
      setPreference,
    }),
    [preference, systemDark, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
