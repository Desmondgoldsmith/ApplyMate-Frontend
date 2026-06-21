import { NEXTAUTH_API_BASE_PATH } from '@/lib/nextauth-api';
import { normalizeNextAuthUrl } from '@/lib/server/ensure-env';

/** Canonical NextAuth base URL, e.g. `https://app.example.com/api/auth`. */
export function getNextAuthBaseUrl(): string {
  normalizeNextAuthUrl();
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      const path = url.pathname.replace(/\/$/, '') || '';
      if (path === NEXTAUTH_API_BASE_PATH) {
        return `${url.origin}${NEXTAUTH_API_BASE_PATH}`;
      }
      if (path === '' || path === '/') {
        return `${url.origin}${NEXTAUTH_API_BASE_PATH}`;
      }
      return raw.replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }
  return `http://localhost:3001${NEXTAUTH_API_BASE_PATH}`;
}

/** Google Cloud Console → Authorized redirect URIs (must match exactly). */
export function getGoogleOAuthRedirectUri(): string {
  return `${getNextAuthBaseUrl()}/callback/google`;
}

/** Fingerprint for status/debug — never log full client id. */
export function googleClientIdFingerprint(): string | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id || id.length < 8) return null;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}
