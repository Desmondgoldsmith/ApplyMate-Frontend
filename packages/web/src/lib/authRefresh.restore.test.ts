import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearApplymateAuthCookies,
  writeApplymateAuthCookie,
} from '@/lib/authCookie';
import { tryRestoreSessionFromApiCookie } from '@/lib/authRefresh';
import { useAuthStore } from '@/store/useAuthStore';

const { me } = vi.hoisted(() => ({ me: vi.fn() }));

vi.mock('@/lib/api', () => ({ api: { users: { me } } }));

vi.mock('@/lib/authSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authSync')>()),
  broadcastAuthLogout: vi.fn(),
  broadcastAuthTokensUpdated: vi.fn(),
}));

function b64urlJson(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const FRESH_ACCESS = `${b64urlJson({ alg: 'none' })}.${b64urlJson({
  exp: Math.floor(Date.now() / 1000) + 900,
})}.sig`;

function httpError(status?: number): AxiosError {
  const response =
    status === undefined
      ? undefined
      : ({
          status,
          data: {},
          statusText: '',
          headers: {},
          config: { headers: new AxiosHeaders() },
        } as AxiosResponse);
  return new AxiosError('failed', undefined, undefined, undefined, response);
}

describe('tryRestoreSessionFromApiCookie', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth({ skipBroadcast: true });
    writeApplymateAuthCookie(FRESH_ACCESS);
  });

  afterEach(() => {
    clearApplymateAuthCookies();
    me.mockReset();
  });

  it('keeps the session when the API cannot be reached', async () => {
    me.mockRejectedValue(httpError());
    await expect(tryRestoreSessionFromApiCookie()).resolves.toBe(true);
    expect(useAuthStore.getState().accessToken).toBe(FRESH_ACCESS);
  });

  it('keeps the session while the API is restarting', async () => {
    me.mockRejectedValue(httpError(502));
    await expect(tryRestoreSessionFromApiCookie()).resolves.toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('signs out when the API rejects the token', async () => {
    me.mockRejectedValue(httpError(401));
    await expect(tryRestoreSessionFromApiCookie()).resolves.toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
