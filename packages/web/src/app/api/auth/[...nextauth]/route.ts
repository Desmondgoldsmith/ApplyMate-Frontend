import { ensureServerEnv, normalizeNextAuthUrl } from '@/lib/server/ensure-env';

import NextAuth from 'next-auth';

import { getAuthOptions } from '@/lib/auth-options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

ensureServerEnv();
normalizeNextAuthUrl();

const handler = NextAuth(getAuthOptions());

export { handler as GET, handler as POST };
