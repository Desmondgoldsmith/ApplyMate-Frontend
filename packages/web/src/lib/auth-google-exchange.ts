import {
  mapNormalizedUserToAuthUser,
  normalizeAuthResponse,
} from '@/lib/auth-response';
import type { AuthUser } from '@/lib/api';
import { API_BASE_URL } from '@/lib/axios';
import { GoogleAuthExchangeError } from '@/lib/google-auth-exchange-error';

export { GoogleAuthExchangeError };

type GoogleAuthPayload = {
  idToken: string;
  name?: string;
  image?: string;
  /** `login` = existing account only; `register` = create account if new. */
  intent?: 'login' | 'register';
};

function parseApiErrorMessage(data: unknown, status: number): string {
  if (data !== null && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const nested = o.error;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const msg = (nested as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
      if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
      const code = (nested as { code?: unknown }).code;
      if (typeof code === 'string' && code.trim()) return code.trim();
    }
    if (typeof o.message === 'string' && o.message.trim())
      return o.message.trim();
  }

  switch (status) {
    case 400:
      return 'Google sign-in is not configured on the API';
    case 401:
      return 'Google token rejected by API (invalid or wrong client ID)';
    case 404:
      return 'No account found for this Google email';
    case 409:
      return 'An account with this email already exists';
    case 429:
      return 'Too many sign-in attempts';
    default:
      return `Google sign-in failed (HTTP ${status})`;
  }
}

function parseApiErrorStatus(data: unknown, httpStatus: number): number {
  if (data !== null && typeof data === 'object') {
    const nested = (data as Record<string, unknown>).error;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const statusCode = Number(
        (nested as { statusCode?: unknown }).statusCode,
      );
      if (Number.isFinite(statusCode) && statusCode >= 400) return statusCode;
    }
  }
  return httpStatus || 500;
}

function parseApiErrorCode(data: unknown): string | undefined {
  if (data === null || typeof data !== 'object') return undefined;
  const nested = (data as Record<string, unknown>).error;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const code = (nested as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  return undefined;
}

/**
 * Exchange a Google ID token for ApplyMate tokens + user (POST /auth/google).
 * Server-only — call from route handlers, not client components.
 */
export async function exchangeGoogleIdTokenWithBackend(
  payload: GoogleAuthPayload,
): Promise<{ accessToken: string; refreshToken?: string; user: AuthUser }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        idToken: payload.idToken,
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.image ? { image: payload.image } : {}),
        ...(payload.intent ? { intent: payload.intent } : {}),
      }),
      cache: 'no-store',
    });
  } catch {
    throw new GoogleAuthExchangeError(
      `Cannot reach API at ${API_BASE_URL}auth/google — is the backend running?`,
      503,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new GoogleAuthExchangeError(
      parseApiErrorMessage(data, res.status),
      parseApiErrorStatus(data, res.status),
      parseApiErrorCode(data),
    );
  }

  if (data !== null && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (o.success === false) {
      throw new GoogleAuthExchangeError(
        parseApiErrorMessage(data, res.status),
        parseApiErrorStatus(data, res.status),
        parseApiErrorCode(data),
      );
    }
  }

  try {
    const normalized = normalizeAuthResponse(data);
    const user = mapNormalizedUserToAuthUser(normalized.user, {
      name: payload.name,
      image: payload.image,
    });

    return {
      accessToken: normalized.accessToken,
      refreshToken: normalized.refreshToken,
      user,
    };
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'Invalid auth response from API';
    throw new GoogleAuthExchangeError(message, 502);
  }
}
