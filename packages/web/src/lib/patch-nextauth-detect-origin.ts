import { createRequire } from 'node:module';
import path from 'node:path';

import { getNextAuthBaseUrl } from '@/lib/nextauth-url';

let patched = false;

/**
 * On Vercel, NextAuth `detectOrigin()` returns the host only. When `NEXTAUTH_URL`
 * includes `/api/auth`, prefer that full value so authorize + token exchange use
 * the same redirect_uri as Google Cloud Console.
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
        const parsed = new URL(configured);
        if (parsed.pathname.replace(/\/$/, '') === '/api/auth') {
          return configured;
        }
      } catch {
        /* fall through */
      }
      const proto = protocol === 'http' ? 'http' : 'https';
      const host = forwardedHost?.split(',')[0]?.trim();
      if (host) return `${proto}://${host}/api/auth`;
      return native(forwardedHost, protocol);
    };
  } catch {
    /* Non-fatal — default detectOrigin still works when NEXTAUTH_URL path is /api/auth */
  }
}
