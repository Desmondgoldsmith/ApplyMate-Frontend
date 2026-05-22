import { afterEach, describe, expect, it, vi } from 'vitest';

import { APPLYMATE_AUTH_COOKIE, LEGACY_TOKEN_STORAGE_KEY, readApplymateTokenFromCookie } from '@/lib/authCookie';
import { useAuthStore } from '@/store/useAuthStore';

const baseUser = {
  id: 'u1',
  email: 'a@b.c',
  onboardingCompleted: true,
  selectedFeatures: ['cv'] as string[],
  primaryGoal: null as string | null,
};

describe('useAuthStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = `${APPLYMATE_AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    useAuthStore.getState().clearAuth({ skipBroadcast: true });
  });

  it('setAuth writes cookie and does not persist token in localStorage', () => {
    window.localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, 'old');
    useAuthStore.getState().setAuth(baseUser as never, 'tok-en');

    expect(window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)).toBeNull();
    expect(readApplymateTokenFromCookie()).toBe('tok-en');
    expect(useAuthStore.getState().accessToken).toBe('tok-en');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('hydrateFromStorage restores token from cookie into memory only', () => {
    document.cookie = `${APPLYMATE_AUTH_COOKIE}=${encodeURIComponent('from-cookie')}; path=/`;
    useAuthStore.setState({ accessToken: null, isAuthenticated: false });
    useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState().accessToken).toBe('from-cookie');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('logout-style clearAuth removes session (memory + cookie)', () => {
    useAuthStore.getState().setAuth(baseUser as never, 'x');
    window.localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, 'y');

    useAuthStore.getState().clearAuth({ skipBroadcast: true });

    expect(readApplymateTokenFromCookie()).toBeNull();
    expect(window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
