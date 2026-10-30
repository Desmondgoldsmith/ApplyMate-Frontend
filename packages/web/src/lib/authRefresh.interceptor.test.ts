import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function jwtExpiringIn(seconds: number, id: string): string {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `${b64urlJson({ alg: 'none', typ: 'JWT' })}.${b64urlJson({ exp, jti: id })}.sig`;
}

const EXPIRED_ACCESS = jwtExpiringIn(-60, 'expired');
const FRESH_ACCESS = jwtExpiringIn(900, 'fresh');
const NEW_ACCESS = jwtExpiringIn(900, 'new');
const REFRESH = 'refresh-1';
const NEW_REFRESH = 'refresh-2';

function refreshSucceeds() {
  post.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      status: 200,
      data: {
        accessToken: NEW_ACCESS,
        refreshToken: NEW_REFRESH,
        user: { id: 'user-1', email: 'jane@example.com' },
      },
    };
  });
}

function refreshPosts() {
  return post.mock.calls.filter(([url]) => url === '/auth/refresh');
}

function sentBearer(config: InternalAxiosRequestConfig): string {
  const raw = config.headers?.Authorization;
  return typeof raw === 'string' ? raw.replace(/^Bearer /, '') : '';
}

function respond(
  config: InternalAxiosRequestConfig,
  status: number,
): Promise<AxiosResponse> {
  const response: AxiosResponse = {
    status,
    statusText: String(status),
    data: {},
    headers: {},
    config,
  };
  if (status >= 400) {
    return Promise.reject(
      new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      ),
    );
  }
  return Promise.resolve(response);
}

/** API client wired like `axios.ts` + `Providers`: header interceptor first, refresh interceptor second. */
async function openApp(acceptedToken: () => string) {
  vi.resetModules();
  const authRefresh = await import('@/lib/authRefresh');
  const { useAuthStore } = await import('@/store/useAuthStore');
  useAuthStore.getState().hydrateFromStorage();

  const adapter = vi.fn((config: InternalAxiosRequestConfig) =>
    respond(config, sentBearer(config) === acceptedToken() ? 200 : 401),
  );
  const client = axios.create({ adapter });
  client.interceptors.request.use((config) => {
    const token =
      useAuthStore.getState().accessToken?.trim() ||
      readApplymateTokenFromCookie()?.trim();
    config.headers = config.headers ?? new AxiosHeaders();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  authRefresh.setupAuthRefreshInterceptor(client);
  return { client, adapter, useAuthStore };
}

beforeEach(() => {
  post.mockReset();
  clearApplymateAuthCookies();
  writeApplymateRefreshCookie(REFRESH);
});

afterEach(() => {
  clearApplymateAuthCookies();
});

describe('auth refresh interceptor', { timeout: 20_000 }, () => {
  it('refreshes an expired access token before sending, so no request answers 401', async () => {
    writeApplymateAuthCookie(EXPIRED_ACCESS);
    refreshSucceeds();
    const { client, adapter } = await openApp(() => NEW_ACCESS);

    await Promise.all([
      client.get('/cv/profile'),
      client.get('/cv/profiles'),
      client.get('/dashboard/today-plan'),
    ]);

    expect(refreshPosts()).toHaveLength(1);
    expect(adapter).toHaveBeenCalledTimes(3);
    for (const [config] of adapter.mock.calls) {
      expect(sentBearer(config)).toBe(NEW_ACCESS);
    }
  });

  it('retries with the rotated token instead of rotating again', async () => {
    writeApplymateAuthCookie(FRESH_ACCESS);
    refreshSucceeds();
    let accepted = FRESH_ACCESS;
    const { client, adapter, useAuthStore } = await openApp(() => accepted);
    adapter.mockImplementationOnce((config) => {
      /** Another request rotated the tokens while this one was in flight. */
      accepted = NEW_ACCESS;
      useAuthStore.setState({ accessToken: NEW_ACCESS });
      return respond(config, 401);
    });

    await expect(client.get('/users/me')).resolves.toMatchObject({
      status: 200,
    });
    expect(refreshPosts()).toHaveLength(0);
    expect(sentBearer(adapter.mock.calls[1][0])).toBe(NEW_ACCESS);
  });

  it('keeps the session when the API is unreachable during refresh', async () => {
    writeApplymateAuthCookie(EXPIRED_ACCESS);
    post.mockRejectedValue(
      new AxiosError('Network Error', AxiosError.ERR_NETWORK),
    );
    const { client, useAuthStore } = await openApp(() => NEW_ACCESS);

    await expect(client.get('/users/me')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('signs out when the API rejects the refresh token', async () => {
    writeApplymateAuthCookie(EXPIRED_ACCESS);
    post.mockImplementation((url: string) =>
      respond(
        {
          url,
          headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig,
        401,
      ),
    );
    const { client, useAuthStore } = await openApp(() => NEW_ACCESS);

    await expect(client.get('/users/me')).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
