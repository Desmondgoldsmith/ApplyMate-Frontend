import { ensureServerEnv } from '@/lib/server/ensure-env';

import { NextResponse } from 'next/server';

import { isGoogleAuthConfigured } from '@/lib/auth-options';
import { API_BASE_URL } from '@/lib/axios';

export const dynamic = 'force-dynamic';

/** Dev helper — open in browser to verify Google OAuth env (no secrets returned). */
export async function GET() {
  ensureServerEnv();
  return NextResponse.json({
    googleAuthConfigured: isGoogleAuthConfigured(),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
    apiBaseUrl: API_BASE_URL,
    hint: isGoogleAuthConfigured()
      ? 'Env looks OK. If sign-in still fails, check /api/auth/providers shows "google" and backend GOOGLE_CLIENT_ID matches.'
      : 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET in repo root .env, run npm run dev (syncs to packages/web/.env.local), then restart.',
  });
}
