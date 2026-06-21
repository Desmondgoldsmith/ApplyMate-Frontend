import { createRequire } from 'node:module';
import path from 'node:path';

import { NEXTAUTH_API_BASE_PATH } from '@/lib/nextauth-api';
import { getNextAuthBaseUrl } from '@/lib/nextauth-url';

let patched = false;

/**
 * On Vercel, NextAuth `detectOrigin()` returns the host only (ignores `NEXTAUTH_URL`).
 * Always prefer our canonical base so authorize + token exchange share the same redirect_uri.
 */
export function patchNextAuthDetectOrigin(): void {
  if (patched) return;
  patched = true;

  try {
    const requireMod = createRequire(path.join(process.cwd(), 'package.json'));
    const nextAuthRoot = path.dirname(requireMod.resolve('next-auth/package.json'));
    const mod = requireMod(path.join(nextAuthRoot, 'utils', 'detect-origin.js')) as {
      detectOrigin: (host?: string, protocol?: string) => string;
    };

    const native = mod.detectOrigin.bind(mod);
    mod.detectOrigin = (forwardedHost?: string, protocol?: string) => {
      const configured = getNextAuthBaseUrl();
      try {
        new URL(configured);
        return configured;
      } catch {
        /* fall through */
      }
      const proto = protocol === 'http' ? 'http' : 'https';
      const host = forwardedHost?.split(',')[0]?.trim();
      if (host) return `${proto}://${host}${NEXTAUTH_API_BASE_PATH}`;
      return native(forwardedHost, protocol);
    };
  } catch {
    /* Non-fatal — parseUrl() still defaults pathname `/` to /api/auth */
  }
}
