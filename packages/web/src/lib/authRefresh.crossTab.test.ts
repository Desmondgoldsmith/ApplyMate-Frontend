import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearApplymateAuthCookies,
  readApplymateTokenFromCookie,
  writeApplymateAuthCookie,
  writeApplymateRefreshCookie,
} from '@/lib/authCookie';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@/lib/axios', () => ({
  API_BASE_URL: '/api/',
  axiosClient: { post },
  getApiBaseUrl: () => '/api/',
  throwIfApiFailureResponse: () => undefined,
}));

vi.mock('@/lib/authSync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authSync')>()),
  broadcastAuthLogout: vi.fn(),
  broadcastAuthTokensUpdated: vi.fn(),
}));

function b64urlJson(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwtExpiringIn(seconds: number, id: string): string {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `${b64urlJson({ alg: 'none', typ: 'JWT' })}.${b64urlJson({ exp, jti: id })}.sig`;
}

const OLD_ACCESS = jwtExpiringIn(60, 'old');
const NEW_ACCESS = jwtExpiringIn(900, 'new');
const OLD_REFRESH = 'refresh-old';
const NEW_REFRESH = 'refresh-new';

/** FIFO mutex standing in for `navigator.locks` (shared by every "tab" in a test). */
function installLockManager() {
  let tail: Promise<unknown> = Promise.resolve();
  const request = vi.fn((_name: string, callback: () => Promise<unknown>) => {
    const run = tail.then(() => callback());
    tail = run.catch(() => undefined);
    return run;
  });
  Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
  return request;
}

function removeLockManager() {
  Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
}

/** Fresh module graph = a separate tab: own Zustand store and `refreshInFlight`, shared cookies. */
async function openTab() {
  vi.resetModules();
  const authRefresh = await import('@/lib/authRefresh');
  const { useAuthStore } = await import('@/store/useAuthStore');
  useAuthStore.getState().hydrateFromStorage();
  return {
    refreshAccessToken: authRefresh.refreshAccessToken,
    tryRestoreSessionFromApiCookie: authRefresh.tryRestoreSessionFromApiCookie,
    useAuthStore,
  };
}

function refreshResponse() {
  return {
    status: 200,
    data: {
      accessToken: NEW_ACCESS,
      refreshToken: NEW_REFRESH,
      user: { id: 'user-1', email: 'jane@example.com' },
    },
  };
}

function refreshPosts() {
  return post.mock.calls.filter(([url]) => url === '/auth/refresh');
}

// Cold first import (module transform) can pass the 10s default hook timeout in full parallel runs.
beforeAll(async () => {
  await import('@/lib/authRefresh');
  await import('@/store/useAuthStore');
}, 60_000);

beforeEach(() => {
  post.mockReset();
  post.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return refreshResponse();
  });
  clearApplymateAuthCookies();
  writeApplymateAuthCookie(OLD_ACCESS);
  writeApplymateRefreshCookie(OLD_REFRESH);
});

afterEach(() => {
  removeLockManager();
  clearApplymateAuthCookies();
});

describe('refreshAccessToken across tabs', { timeout: 20_000 }, () => {
  it('sends one POST when two tabs refresh at the same moment', async () => {
    const lockRequest = installLockManager();
    const tabA = await openTab();
    const tabB = await openTab();

    const [a, b] = await Promise.all([
      tabA.refreshAccessToken(),
      tabB.refreshAccessToken(),
    ]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(refreshPosts()).toHaveLength(1);
    expect(refreshPosts()[0]?.[1]).toEqual({ refreshToken: OLD_REFRESH });
    expect(lockRequest).toHaveBeenCalledTimes(2);
    expect(lockRequest.mock.calls[0]?.[0]).toBe('applymate-auth-refresh');
    expect(tabA.useAuthStore.getState().accessToken).toBe(NEW_ACCESS);
    expect(tabB.useAuthStore.getState().accessToken).toBe(NEW_ACCESS);
    expect(tabB.useAuthStore.getState().refreshToken).toBe(NEW_REFRESH);
  });

  it('skips the POST when another tab already refreshed the cookie', async () => {
    installLockManager();
    const tab = await openTab();
    expect(tab.useAuthStore.getState().accessToken).toBe(OLD_ACCESS);

    writeApplymateAuthCookie(NEW_ACCESS);
    writeApplymateRefreshCookie(NEW_REFRESH);

    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    expect(refreshPosts()).toHaveLength(0);
    expect(tab.useAuthStore.getState().accessToken).toBe(NEW_ACCESS);
    expect(tab.useAuthStore.getState().refreshToken).toBe(NEW_REFRESH);
  });

  it('still refreshes when the changed cookie token is itself about to expire', async () => {
    installLockManager();
    const tab = await openTab();

    writeApplymateAuthCookie(jwtExpiringIn(30, 'other-tab-stale'));

    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    expect(refreshPosts()).toHaveLength(1);
    expect(readApplymateTokenFromCookie()).toBe(NEW_ACCESS);
  });

  it('sends the shared cookie refresh token, not a stale in-memory one', async () => {
    installLockManager();
    const tab = await openTab();
    expect(tab.useAuthStore.getState().refreshToken).toBe(OLD_REFRESH);

    writeApplymateAuthCookie(jwtExpiringIn(30, 'rotated-long-ago'));
    writeApplymateRefreshCookie('refresh-rotated-long-ago');

    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    expect(refreshPosts()).toHaveLength(1);
    expect(refreshPosts()[0]?.[1]).toEqual({ refreshToken: 'refresh-rotated-long-ago' });
  });

  it('sends one cookie-only refresh when two tabs restore a session together', async () => {
    installLockManager();
    clearApplymateAuthCookies();
    const tabA = await openTab();
    const tabB = await openTab();

    const [a, b] = await Promise.all([
      tabA.tryRestoreSessionFromApiCookie(),
      tabB.tryRestoreSessionFromApiCookie(),
    ]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(refreshPosts()).toHaveLength(1);
    expect(refreshPosts()[0]?.[1]).toEqual({});
    expect(tabB.useAuthStore.getState().accessToken).toBe(NEW_ACCESS);
  });

  it('keeps single-tab behaviour when Web Locks are unavailable', async () => {
    removeLockManager();
    const tab = await openTab();

    const [first, second] = await Promise.all([
      tab.refreshAccessToken(),
      tab.refreshAccessToken(),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(refreshPosts()).toHaveLength(1);
    expect(tab.useAuthStore.getState().accessToken).toBe(NEW_ACCESS);
  });

  it('allows a later refresh after one that had no refresh token', async () => {
    installLockManager();
    clearApplymateAuthCookies();
    writeApplymateAuthCookie(OLD_ACCESS);
    const tab = await openTab();

    await expect(tab.refreshAccessToken()).resolves.toBe(false);
    expect(refreshPosts()).toHaveLength(0);

    writeApplymateRefreshCookie(OLD_REFRESH);
    tab.useAuthStore.setState({ refreshToken: OLD_REFRESH });

    await expect(tab.refreshAccessToken()).resolves.toBe(true);
    expect(refreshPosts()).toHaveLength(1);
  });
});
