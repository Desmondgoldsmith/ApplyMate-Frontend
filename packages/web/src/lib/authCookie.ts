/**
 * Auth session cookie (non-httpOnly) used for middleware + axios Bearer fallback.
 * Tokens must NOT be stored in localStorage (XSS surface).
 */
export const APPLYMATE_AUTH_COOKIE = 'applymate_token';
export const APPLYMATE_REFRESH_COOKIE = 'applymate_refresh_token';
/** Legacy key — removed on hydrate for one-time migration. */
export const LEGACY_TOKEN_STORAGE_KEY = 'applymate_token';

export function readApplymateTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === APPLYMATE_AUTH_COOKIE && rest.length > 0) {
      const raw = rest.join('=').trim();
      if (raw) return decodeURIComponent(raw);
    }
  }
  return null;
}

export function writeApplymateAuthCookie(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${APPLYMATE_AUTH_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

export function clearApplymateAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${APPLYMATE_AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function readApplymateRefreshTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === APPLYMATE_REFRESH_COOKIE && rest.length > 0) {
      const raw = rest.join('=').trim();
      if (raw) return decodeURIComponent(raw);
    }
  }
  return null;
}

export function writeApplymateRefreshCookie(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${APPLYMATE_REFRESH_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

export function clearApplymateRefreshCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${APPLYMATE_REFRESH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/** Clear access + refresh session cookies. */
export function clearApplymateAuthCookies(): void {
  clearApplymateAuthCookie();
  clearApplymateRefreshCookie();
}

/** One-time migration: drop legacy localStorage token (no longer used). */
export function removeLegacyTokenFromLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
