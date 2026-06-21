import { ensureServerEnv, normalizeNextAuthUrl } from '@/lib/server/ensure-env';

import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';

import { getAuthOptions } from '@/lib/auth-options';
import { patchNextAuthDetectOrigin } from '@/lib/patch-nextauth-detect-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

ensureServerEnv();
normalizeNextAuthUrl();
patchNextAuthDetectOrigin();

const handler = NextAuth(getAuthOptions());

type RouteContext = { params: Promise<{ nextauth: string[] }> };

/** NextAuth catch-all treats `/api/auth/google/*` as action `google` → 404. Delegate explicitly. */
async function maybeHandleGoogleOAuthRoute(req: NextRequest): Promise<Response | null> {
  const pathname = new URL(req.url).pathname.replace(/\/$/, '');
  if (pathname === '/api/auth/google/finish') {
    const { GET: finishGet } = await import('../google/finish/route');
    return finishGet(req);
  }
  if (pathname === '/api/auth/google/status') {
    const { GET: statusGet } = await import('../google/status/route');
    return statusGet();
  }
  return null;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const delegated = await maybeHandleGoogleOAuthRoute(req);
  if (delegated) return delegated;
  return handler(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const delegated = await maybeHandleGoogleOAuthRoute(req);
  if (delegated) return delegated;
  return handler(req, context);
}
