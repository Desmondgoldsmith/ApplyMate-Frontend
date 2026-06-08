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
import { API_BASE_URL, axiosClient, throwIfApiFailureResponse } from '@/lib/axios';
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
  if (typeof root.code === 'string' && root.code.trim()) return root.code.trim();
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

function getRefreshTokenForRequest(): string | null {
  const fromMemory = useAuthStore.getState().refreshToken?.trim();
  if (fromMemory) return fromMemory;
  return readApplymateRefreshTokenFromCookie()?.trim() ?? null;
}

let refreshInFlight: Promise<boolean> | null = null;

async function postRefreshWithApiCookie(): Promise<boolean> {
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
    return true;
  } catch {
    return false;
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
      baseURL: API_BASE_URL,
    },
  );
  throwIfApiFailureResponse(res.data, res.status);
  return normalizeAuthResponse(res.data);
}

/**
 * Rotate access + refresh tokens (single-flight). Returns true when new tokens are stored.
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshTokenForRequest();
    if (!refreshToken) return false;

    try {
      const normalized = await postRefresh(refreshToken);
      const user = mapNormalizedUserToAuthUser(normalized.user);
      useAuthStore
        .getState()
        .setAuth(user, normalized.accessToken, normalized.refreshToken ?? refreshToken);
      broadcastAuthTokensUpdated();
      return true;
    } catch (error) {
      if (isRefreshTokenReuseError(error)) {
        forceAuthSignOut('reuse');
      } else {
        forceAuthSignOut('expired');
      }
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

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
  return /(^|\/)(auth\/login|auth\/register|auth\/google)(\/?$|[/?#])/i.test(url);
}

let refreshInterceptorInstalled = false;

/** Attach 401 → refresh → retry once; sign out when refresh fails. */
export function setupAuthRefreshInterceptor(client: AxiosInstance): void {
  if (refreshInterceptorInstalled) return;
  refreshInterceptorInstalled = true;

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
  let intervalId: number | undefined;

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
  intervalId = window.setInterval(tick, FALLBACK_REFRESH_INTERVAL_MS);

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
    if (intervalId != null) window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibility);
    unsubTokens();
  };
}
