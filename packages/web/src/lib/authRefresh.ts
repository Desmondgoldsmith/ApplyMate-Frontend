import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  readApplymateRefreshTokenFromCookie,
  readApplymateTokenFromCookie,
} from '@/lib/authCookie';
import {
  mapNormalizedUserToAuthUser,
  normalizeAuthResponse,
  normalizeRefreshResponse,
} from '@/lib/auth-response';
import {
  broadcastAuthTokensUpdated,
  subscribeAuthTokensUpdated,
} from '@/lib/authSync';
import type { ErrorBody } from '@/lib/axios';
import {
  API_BASE_URL,
  axiosClient,
  getApiBaseUrl,
  throwIfApiFailureResponse,
} from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

/** Refresh ~2 minutes before JWT `exp`. */
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;
/** Fallback interval while the tab is open (access TTL default 15m). */
const FALLBACK_REFRESH_INTERVAL_MS = 13 * 60 * 1000;

export const REFRESH_TOKEN_REUSE_SESSION_KEY = 'applymate_logout_reason';
export const REFRESH_TOKEN_REUSE_CODE = 'REFRESH_TOKEN_REUSE_DETECTED';

function readNestedErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const root = data as Record<string, unknown>;
  const err = root.error;
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  if (typeof root.code === 'string' && root.code.trim())
    return root.code.trim();
  return undefined;
}

export function isRefreshTokenReuseError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<ErrorBody>;
  if (readNestedErrorCode(ax.response?.data) === REFRESH_TOKEN_REUSE_CODE) {
    return true;
  }
  const blob =
    typeof ax.response?.data === 'object' && ax.response?.data
      ? JSON.stringify(ax.response.data)
      : '';
  return blob.includes(REFRESH_TOKEN_REUSE_CODE);
}

/** API unreachable or failing (restart, deploy, proxy 502, rate limit) — the refresh token may still be valid. */
function isTransientRefreshFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status === undefined) return true;
  return status >= 500 || status === 408 || status === 429;
}

/** Decode JWT `exp` (seconds since epoch); returns null when not a JWT. */
export function decodeJwtExp(token: string): number | null {
  const parts = token.trim().split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp
      : null;
  } catch {
    return null;
  }
}

/**
 * Cookie first: it is shared by every tab, so it holds the latest rotation. A tab's in-memory copy can be
 * an already-rotated token, which the API treats as reuse and answers by ending the session.
 */
function getRefreshTokenForRequest(): string | null {
  const fromCookie = readApplymateRefreshTokenFromCookie()?.trim();
  if (fromCookie) return fromCookie;
  return useAuthStore.getState().refreshToken?.trim() || null;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Empty body: the API rotates the session from its HttpOnly refresh cookie. */
async function postRefreshWithApiCookie(): Promise<boolean> {
  const known = readKnownAuthTokens();
  return withAuthRefreshLock(async () => {
    if (adoptTokensRefreshedByAnotherTab(known)) return true;
    return (await postRefreshWithApiCookieHoldingLock()).ok;
  });
}

type RefreshAttempt = { ok: true } | { ok: false; error: unknown };

/** Caller must hold the auth refresh lock (Web Locks are not re-entrant). */
async function postRefreshWithApiCookieHoldingLock(): Promise<RefreshAttempt> {
  try {
    const res = await axiosClient.post<unknown>(
      '/auth/refresh',
      {},
      { skipAuthRefresh: true },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const normalized = normalizeRefreshResponse(res.data);
    const user = mapNormalizedUserToAuthUser(normalized.user);
    useAuthStore
      .getState()
      .setAuth(user, normalized.accessToken, normalized.refreshToken);
    broadcastAuthTokensUpdated();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Restore a web session when the extension (or API HttpOnly refresh cookie) is still valid
 * but readable web cookies are missing or expired.
 */
export async function tryRestoreSessionFromApiCookie(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const token = readApplymateTokenFromCookie()?.trim();
  if (token) {
    const exp = decodeJwtExp(token);
    if (exp == null || exp * 1000 > Date.now() + 30_000) {
      useAuthStore.getState().hydrateFromStorage();
      const state = useAuthStore.getState();
      if (state.isAuthenticated && !state.user?.id) {
        try {
          const { api } = await import('@/lib/api');
          const user = await api.users.me();
          useAuthStore
            .getState()
            .setAuth(
              user,
              token,
              state.refreshToken ?? readApplymateRefreshTokenFromCookie(),
            );
        } catch {
          useAuthStore.getState().clearAuth({ skipBroadcast: true });
          return false;
        }
      }
      return useAuthStore.getState().isAuthenticated;
    }
  }

  const refresh = readApplymateRefreshTokenFromCookie()?.trim();
  if (refresh) {
    return refreshAccessToken();
  }

  return postRefreshWithApiCookie();
}

async function postRefresh(refreshToken: string) {
  const res = await axiosClient.post<unknown>(
    '/auth/refresh',
    { refreshToken },
    {
      skipAuthRefresh: true,
      baseURL: getApiBaseUrl(),
    },
  );
  throwIfApiFailureResponse(res.data, res.status);
  return normalizeAuthResponse(res.data);
}

/** Web Locks name shared by every tab on this origin. */
export const AUTH_REFRESH_LOCK_NAME = 'applymate-auth-refresh';

/**
 * Tabs share token cookies and schedule refresh for the same moment; refresh tokens are one-time-use,
 * so only one tab may call `/auth/refresh` at a time. Runs `fn` directly where Web Locks are missing.
 */
function withAuthRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks?.request) return fn();
  /** The lock is held until the callback's promise settles. */
  return new Promise<T>((resolve, reject) => {
    locks
      .request(AUTH_REFRESH_LOCK_NAME, () => fn().then(resolve, reject))
      .catch(reject);
  });
}

type KnownAuthTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

/** This tab's view, not the shared cookies — another tab may have rotated them already. */
function readKnownAuthTokens(): KnownAuthTokens {
  const state = useAuthStore.getState();
  return {
    accessToken:
      state.accessToken?.trim() ||
      readApplymateTokenFromCookie()?.trim() ||
      null,
    refreshToken:
      state.refreshToken?.trim() ||
      readApplymateRefreshTokenFromCookie()?.trim() ||
      null,
  };
}

function isAccessTokenFresh(token: string): boolean {
  const exp = decodeJwtExp(token);
  return exp == null || exp * 1000 > Date.now() + REFRESH_BEFORE_EXPIRY_MS;
}

/**
 * Another tab may have rotated tokens while this one waited for the lock. Adopts the shared cookies when
 * either token changed; returns true (skip `/auth/refresh`) only when a new, fresh access token arrived.
 */
function adoptTokensRefreshedByAnotherTab(known: KnownAuthTokens): boolean {
  const cookieAccess = readApplymateTokenFromCookie()?.trim() || null;
  const cookieRefresh = readApplymateRefreshTokenFromCookie()?.trim() || null;
  const accessRotated =
    cookieAccess !== null && cookieAccess !== known.accessToken;
  const refreshRotated =
    cookieRefresh !== null && cookieRefresh !== known.refreshToken;
  if (!accessRotated && !refreshRotated) return false;
  useAuthStore.getState().hydrateFromStorage();
  return accessRotated && isAccessTokenFresh(cookieAccess);
}

/**
 * Rotate access + refresh tokens (single-flight per tab, one tab at a time). Returns true when new
 * tokens are stored.
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const known = readKnownAuthTokens();

  refreshInFlight = withAuthRefreshLock(async () => {
    if (adoptTokensRefreshedByAnotherTab(known)) return true;

    const refreshToken = getRefreshTokenForRequest();
    if (!refreshToken) {
      const viaCookie = await postRefreshWithApiCookieHoldingLock();
      if (viaCookie.ok) return true;
      /** Nothing left to refresh with: without this the caller keeps getting 401s on a dead session. */
      if (!isTransientRefreshFailure(viaCookie.error)) {
        forceAuthSignOut('expired');
      }
      return false;
    }

    try {
      const normalized = await postRefresh(refreshToken);
      const user = mapNormalizedUserToAuthUser(normalized.user);
      useAuthStore
        .getState()
        .setAuth(
          user,
          normalized.accessToken,
          normalized.refreshToken ?? refreshToken,
        );
      broadcastAuthTokensUpdated();
      return true;
    } catch (error) {
      if (isRefreshTokenReuseError(error)) {
        forceAuthSignOut('reuse');
      } else if (!isTransientRefreshFailure(error)) {
        forceAuthSignOut('expired');
      }
      return false;
    }
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export type AuthSignOutReason = 'reuse' | 'expired';

export function forceAuthSignOut(reason?: AuthSignOutReason): void {
  if (typeof window !== 'undefined') {
    if (reason === 'reuse') {
      try {
        sessionStorage.setItem(REFRESH_TOKEN_REUSE_SESSION_KEY, 'reuse');
      } catch {
        /* ignore */
      }
    }
    useAuthStore.getState().clearAuth();
    const path = window.location.pathname;
    if (!path.startsWith('/login') && !path.startsWith('/register')) {
      window.location.href = '/login';
    }
  } else {
    useAuthStore.getState().clearAuth();
  }
}

const AUTH_NO_REFRESH_SUBPATH =
  /(^|\/)(auth\/login|auth\/register|auth\/google|auth\/refresh|auth\/logout)(\/?$|[/?#])/i;

function shouldSkipAuthRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_NO_REFRESH_SUBPATH.test(url);
}

function isLoginOrRegisterAttemptUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /(^|\/)(auth\/login|auth\/register|auth\/google)(\/?$|[/?#])/i.test(
    url,
  );
}

let refreshInterceptorInstalled = false;

function readCurrentAccessToken(): string | null {
  return (
    useAuthStore.getState().accessToken?.trim() ||
    readApplymateTokenFromCookie()?.trim() ||
    null
  );
}

function isAccessTokenExpired(token: string): boolean {
  const exp = decodeJwtExp(token);
  return exp != null && exp * 1000 <= Date.now() + 5_000;
}

function readSentBearer(config: InternalAxiosRequestConfig): string | null {
  const raw = config.headers?.Authorization;
  if (typeof raw !== 'string' || !raw.startsWith('Bearer ')) return null;
  return raw.slice('Bearer '.length).trim() || null;
}

/** Attach 401 → refresh → retry once; sign out when refresh fails. */
export function setupAuthRefreshInterceptor(client: AxiosInstance): void {
  if (refreshInterceptorInstalled) return;
  refreshInterceptorInstalled = true;

  /**
   * Runs before the header interceptor in `axios.ts` (axios runs later-registered request interceptors
   * first). Requests wait for a rotation in flight — or start one when the access token is already
   * expired — instead of firing with a dead token and each answering 401 (a burst on every page load).
   */
  client.interceptors.request.use(async (config) => {
    if (
      typeof window === 'undefined' ||
      config.skipAuthRefresh ||
      shouldSkipAuthRefresh(config.url)
    ) {
      return config;
    }
    if (refreshInFlight) {
      await refreshInFlight.catch(() => false);
      return config;
    }
    const access = readCurrentAccessToken();
    if (access && isAccessTokenExpired(access) && getRefreshTokenForRequest()) {
      await refreshAccessToken();
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!axios.isAxiosError(error)) return Promise.reject(error);
      const ax = error as AxiosError<ErrorBody>;
      const status = ax.response?.status;
      const config = ax.config;

      if (status !== 401 || typeof window === 'undefined' || !config) {
        return Promise.reject(error);
      }

      const url = config.url;

      if (config.skipAuthRefresh || shouldSkipAuthRefresh(url)) {
        if (!isLoginOrRegisterAttemptUrl(url)) {
          if (isRefreshTokenReuseError(error)) {
            forceAuthSignOut('reuse');
          }
        }
        return Promise.reject(error);
      }

      if (config._authRetry) {
        forceAuthSignOut('expired');
        return Promise.reject(error);
      }

      /** Tokens rotated while this request was in flight: retry with the new one, no second rotation. */
      const sent = readSentBearer(config);
      const current = readCurrentAccessToken();
      if (
        sent &&
        current &&
        sent !== current &&
        !isAccessTokenExpired(current)
      ) {
        config._authRetry = true;
        return client.request(config);
      }

      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return Promise.reject(error);
      }

      config._authRetry = true;
      const token =
        useAuthStore.getState().accessToken?.trim() ||
        readApplymateTokenFromCookie()?.trim();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return client.request(config);
    },
  );
}

function msUntilRefresh(accessToken: string): number | null {
  const exp = decodeJwtExp(accessToken);
  if (exp == null) return null;
  const refreshAt = exp * 1000 - REFRESH_BEFORE_EXPIRY_MS;
  return Math.max(0, refreshAt - Date.now());
}

function scheduleNextProactiveRefresh(
  accessToken: string | null | undefined,
  onFire: () => void,
): number | undefined {
  if (!accessToken?.trim()) return undefined;
  const delay = msUntilRefresh(accessToken);
  if (delay == null) return undefined;
  return window.setTimeout(onFire, delay);
}

/** Proactive refresh while authenticated; re-schedules after rotation or tab sync. */
export function startAuthTokenRefreshScheduler(): () => void {
  if (typeof window === 'undefined') return () => {};

  let timeoutId: number | undefined;

  const tick = () => {
    const access = readApplymateTokenFromCookie();
    const refresh = readApplymateRefreshTokenFromCookie();
    if (!access?.trim() || !refresh?.trim()) return;
    const exp = decodeJwtExp(access);
    if (exp != null && exp * 1000 <= Date.now() + 30_000) {
      void refreshAccessToken();
      return;
    }
    const delay = msUntilRefresh(access);
    if (delay != null && delay <= 0) {
      void refreshAccessToken();
    }
  };

  const reschedule = () => {
    if (timeoutId != null) window.clearTimeout(timeoutId);
    const access = readApplymateTokenFromCookie();
    timeoutId = scheduleNextProactiveRefresh(access, () => {
      void refreshAccessToken().finally(reschedule);
    });
  };

  reschedule();
  const intervalId = window.setInterval(tick, FALLBACK_REFRESH_INTERVAL_MS);

  const onVisibility = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const unsubTokens = subscribeAuthTokensUpdated(() => {
    useAuthStore.getState().hydrateFromStorage();
    reschedule();
  });

  return () => {
    if (timeoutId != null) window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibility);
    unsubTokens();
  };
}
