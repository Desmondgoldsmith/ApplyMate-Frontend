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

export async function GET(req: NextRequest, context: RouteContext) {
  return handler(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handler(req, context);
}
