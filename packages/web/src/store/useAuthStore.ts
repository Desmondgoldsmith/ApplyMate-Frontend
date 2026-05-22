import { create } from 'zustand';

import type { AuthUser } from '@/lib/api';
import {
  clearApplymateAuthCookie,
  readApplymateTokenFromCookie,
  removeLegacyTokenFromLocalStorage,
  writeApplymateAuthCookie,
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
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: (opts?: ClearAuthOptions) => void;
  /** Restore session token from cookie after full reload (memory-only Zustand resets). */
  hydrateFromStorage: () => void;
  /** Merge fields from GET /api/users/me (and PATCH /me) into the cached user. */
  syncUserFromMe: (user: AuthUser) => void;
  setSelectedFeatures: (features: string[]) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  hydrateFromStorage: () => {
    if (typeof window === 'undefined') return;
    removeLegacyTokenFromLocalStorage();
    const token = readApplymateTokenFromCookie()?.trim();
    if (!token) return;
    if (get().accessToken) return;
    set({ accessToken: token, isAuthenticated: true });
  },
  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      removeLegacyTokenFromLocalStorage();
      writeApplymateAuthCookie(token);
    }
    set({ user: withAuthDefaults(user), accessToken: token, isAuthenticated: true });
  },
  clearAuth: (opts) => {
    if (typeof window !== 'undefined') {
      removeLegacyTokenFromLocalStorage();
      clearStoredWizard();
      clearApplymateAuthCookie();
      if (!opts?.skipBroadcast) {
        broadcastAuthLogout();
      }
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
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
