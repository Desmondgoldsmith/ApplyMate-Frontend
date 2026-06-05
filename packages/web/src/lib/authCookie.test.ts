import { afterEach, describe, expect, it } from 'vitest';

import {
  APPLYMATE_AUTH_COOKIE,
  APPLYMATE_REFRESH_COOKIE,
  clearApplymateAuthCookie,
  clearApplymateAuthCookies,
  LEGACY_TOKEN_STORAGE_KEY,
  readApplymateRefreshTokenFromCookie,
  readApplymateTokenFromCookie,
  removeLegacyTokenFromLocalStorage,
  writeApplymateAuthCookie,
  writeApplymateRefreshCookie,
} from '@/lib/authCookie';

describe('authCookie', () => {
  afterEach(() => {
    document.cookie = `${APPLYMATE_AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${APPLYMATE_REFRESH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  });

  it('reads token from document.cookie', () => {
    writeApplymateAuthCookie('abc123');
    expect(readApplymateTokenFromCookie()).toBe('abc123');
  });

  it('clearApplymateAuthCookie removes readable token', () => {
    writeApplymateAuthCookie('secret');
    clearApplymateAuthCookie();
    expect(readApplymateTokenFromCookie()).toBeNull();
  });

  it('removeLegacyTokenFromLocalStorage drops legacy key', () => {
    window.localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, 'legacy');
    removeLegacyTokenFromLocalStorage();
    expect(window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('writes and clears refresh token cookie', () => {
    writeApplymateRefreshCookie('refresh-xyz');
    expect(readApplymateRefreshTokenFromCookie()).toBe('refresh-xyz');
    clearApplymateAuthCookies();
    expect(readApplymateTokenFromCookie()).toBeNull();
    expect(readApplymateRefreshTokenFromCookie()).toBeNull();
  });
});
