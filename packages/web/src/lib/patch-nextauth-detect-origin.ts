import { createRequire } from 'node:module';
import path from 'node:path';

import { NEXTAUTH_API_BASE_PATH } from '@/lib/nextauth-api';

/**
 * NextAuth v4 `detectOrigin()` on Vercel returns host-only (`https://…vercel.app`).
 * `parseUrl()` then defaults the path to `/api/auth`, but our handlers live at
 * `/api/nextauth` — Google gets the wrong redirect_uri in production only.
 */
export function patchNextAuthDetectOrigin(): void {
  const tagged = patchNextAuthDetectOrigin as typeof patchNextAuthDetectOrigin & {
    __applymatePatched?: boolean;
  };
  if (tagged.__applymatePatched) return;

  const requireMod = createRequire(path.join(process.cwd(), 'package.json'));
  const nextAuthRoot = path.dirname(requireMod.resolve('next-auth/package.json'));
  const mod = requireMod(path.join(nextAuthRoot, 'utils', 'detect-origin.js')) as {
    detectOrigin: (host?: string, protocol?: string) => string;
  };

  const native = mod.detectOrigin.bind(mod);
  mod.detectOrigin = function detectOriginWithCustomBasePath(
    forwardedHost?: string,
    protocol?: string,
  ) {
    const fromEnv = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, '');
    if (fromEnv) {
      try {
        const parsed = new URL(fromEnv);
        if (parsed.pathname.replace(/\/$/, '') === NEXTAUTH_API_BASE_PATH) {
          return fromEnv;
        }
      } catch {
        /* fall through */
      }
    }
    const proto = protocol === 'http' ? 'http' : 'https';
    const host = forwardedHost?.split(',')[0]?.trim();
    if (host) return `${proto}://${host}${NEXTAUTH_API_BASE_PATH}`;
    return native(forwardedHost, protocol);
  };
  tagged.__applymatePatched = true;
}
