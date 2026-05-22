import { afterEach, describe, expect, it } from 'vitest';

import {
  APPLYMATE_AUTH_COOKIE,
  clearApplymateAuthCookie,
  LEGACY_TOKEN_STORAGE_KEY,
  readApplymateTokenFromCookie,
  removeLegacyTokenFromLocalStorage,
  writeApplymateAuthCookie,
} from '@/lib/authCookie';

describe('authCookie', () => {
  afterEach(() => {
    document.cookie = `${APPLYMATE_AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
});
