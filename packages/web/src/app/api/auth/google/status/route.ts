import { ensureServerEnv } from '@/lib/server/ensure-env';

import { NextResponse } from 'next/server';

import { isGoogleAuthConfigured } from '@/lib/auth-options';
import { API_BASE_URL } from '@/lib/axios';
import { NEXTAUTH_API_BASE_PATH } from '@/lib/nextauth-api';
import {
  getGoogleOAuthRedirectUri,
  getNextAuthBaseUrl,
  googleClientIdFingerprint,
} from '@/lib/nextauth-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Dev helper — open in browser to verify Google OAuth env (no secrets returned). */
export async function GET() {
  ensureServerEnv();
  const redirectUri = getGoogleOAuthRedirectUri();
  const clientIdFingerprint = googleClientIdFingerprint();
  const hasSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());
  const secretLooksValid =
    hasSecret && (process.env.GOOGLE_CLIENT_SECRET?.trim().length ?? 0) >= 20;

  return NextResponse.json({
    googleAuthConfigured: isGoogleAuthConfigured(),
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
    hasGoogleClientSecret: hasSecret,
    googleClientSecretLooksValid: secretLooksValid,
    googleClientIdFingerprint: clientIdFingerprint,
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    nextAuthUrl: process.env.NEXTAUTH_URL ?? null,
    nextAuthBaseUrl: getNextAuthBaseUrl(),
    nextAuthBasePath: NEXTAUTH_API_BASE_PATH,
    expectedGoogleRedirectUri: redirectUri,
    googleCloudConsoleChecklist: {
      authorizedJavaScriptOrigins: [
        new URL(getNextAuthBaseUrl()).origin,
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ],
      authorizedRedirectUris: [
        redirectUri,
        'http://localhost:3001/api/auth/callback/google',
        'http://127.0.0.1:3001/api/auth/callback/google',
        'https://apply-mate-frontend.vercel.app/api/auth/callback/google',
      ],
    },
    apiBaseUrl: API_BASE_URL,
    hint: isGoogleAuthConfigured()
      ? `Register expectedGoogleRedirectUri on the SAME OAuth client as googleClientIdFingerprint. OAuthCallback usually means wrong GOOGLE_CLIENT_SECRET or redirect URI mismatch.`
      : 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET in repo root .env, run npm run dev (syncs to packages/web/.env.local), then restart.',
  });
}
