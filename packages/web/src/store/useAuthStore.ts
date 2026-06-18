import { create } from 'zustand';

import type { AuthUser } from '@/lib/api';
import {
  clearApplymateAuthCookies,
  readApplymateRefreshTokenFromCookie,
  readApplymateTokenFromCookie,
  removeLegacyTokenFromLocalStorage,
  writeApplymateAuthCookie,
  writeApplymateRefreshCookie,
} from '@/lib/authCookie';
import { broadcastAuthLogout } from '@/lib/authSync';
import { clearStoredWizard } from '@/lib/onboardingWizardStorage';

function withAuthDefaults(user: AuthUser): AuthUser {
  const selected = user.selectedFeatures?.length
    ? user.selectedFeatures.includes('cv')
      ? user.selectedFeatures
      : [...user.selectedFeatures, 'cv']
    : ['cv'];
  return {
    ...user,
    onboardingCompleted: user.onboardingCompleted ?? false,
    selectedFeatures: selected,
    primaryGoal: user.primaryGoal !== undefined ? user.primaryGoal : null,
  };
}

export type ClearAuthOptions = {
  /** When true, do not notify other tabs (prevents broadcast loops). */
  skipBroadcast?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** False until cookie hydrate + optional refresh restore finish on app boot. */
  authSessionReady: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken?: string | null) => void;
  clearAuth: (opts?: ClearAuthOptions) => void;
  /** Restore session token from cookie after full reload (memory-only Zustand resets). */
  hydrateFromStorage: () => void;
  setAuthSessionReady: (ready: boolean) => void;
  /** Merge fields from GET /api/users/me (and PATCH /me) into the cached user. */
  syncUserFromMe: (user: AuthUser) => void;
  setSelectedFeatures: (features: string[]) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  authSessionReady: false,
  hydrateFromStorage: () => {
    if (typeof window === 'undefined') return;
    removeLegacyTokenFromLocalStorage();
    const token = readApplymateTokenFromCookie()?.trim();
    if (!token) return;
    const refresh = readApplymateRefreshTokenFromCookie()?.trim() ?? null;
    if (get().accessToken === token && get().refreshToken === refresh) return;
    set({
      accessToken: token,
      refreshToken: refresh,
      isAuthenticated: true,
    });
  },
  setAuth: (user, accessToken, refreshToken) => {
    const refresh =
      typeof refreshToken === 'string' && refreshToken.trim()
        ? refreshToken.trim()
        : get().refreshToken;
    if (typeof window !== 'undefined') {
      removeLegacyTokenFromLocalStorage();
      writeApplymateAuthCookie(accessToken);
      if (refresh) writeApplymateRefreshCookie(refresh);
    }
    set({
      user: withAuthDefaults(user),
      accessToken,
      refreshToken: refresh ?? null,
      isAuthenticated: true,
      authSessionReady: true,
    });
  },
  clearAuth: (opts) => {
    if (typeof window !== 'undefined') {
      removeLegacyTokenFromLocalStorage();
      clearStoredWizard();
      clearApplymateAuthCookies();
      void import('@/lib/extensionAuthHandoff').then((m) =>
        m.clearExtensionTokenIfInstalled(),
      );
      if (!opts?.skipBroadcast) {
        broadcastAuthLogout();
      }
    }
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      authSessionReady: true,
    });
  },
  setAuthSessionReady: (ready) => set({ authSessionReady: ready }),
  syncUserFromMe: (next) =>
    set((s) => {
      if (!s.isAuthenticated) return s;
      const base = s.user ?? { id: next.id, email: next.email };
      return { user: withAuthDefaults({ ...base, ...next }) };
    }),
  setSelectedFeatures: (features) =>
    set((s) => ({
      user: s.user ? { ...s.user, selectedFeatures: features } : s.user,
    })),
}));
