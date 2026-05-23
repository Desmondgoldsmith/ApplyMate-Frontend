import '@/lib/server/ensure-env';

import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeGoogleIdTokenWithBackend,
  GoogleAuthExchangeError,
} from '@/lib/auth-google-exchange';
import { isGoogleAuthConfigured } from '@/lib/auth-options';
import { APPLYMATE_AUTH_COOKIE } from '@/lib/authCookie';
import { googleAuthRedirectErrorParam } from '@/lib/google-auth-errors';
import { API_BASE_URL } from '@/lib/axios';

export const dynamic = 'force-dynamic';

function loginRedirect(
  request: NextRequest,
  error: string,
  reason?: string,
): NextResponse {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', error);
  if (reason?.trim()) {
    url.searchParams.set('errorReason', reason.trim().slice(0, 240));
  }
  return NextResponse.redirect(url);
}

async function readGoogleIdToken(request: NextRequest): Promise<string> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName:
      process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
  });
  return typeof token?.googleIdToken === 'string'
    ? token.googleIdToken.trim()
    : '';
}

export async function GET(request: NextRequest) {
  if (!isGoogleAuthConfigured()) {
    return loginRedirect(
      request,
      'GoogleSignInUnavailable',
      'Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or NEXTAUTH_SECRET. Restart dev server after updating .env.',
    );
  }

  const idToken = await readGoogleIdToken(request);
  if (!idToken) {
    return loginRedirect(
      request,
      'GoogleSignInFailed',
      'No Google ID token after OAuth. Check NEXTAUTH_SECRET and redirect URI http://localhost:3001/api/auth/callback/google in Google Cloud.',
    );
  }

  const jwt = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName:
      process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
  });

  try {
    const { accessToken } = await exchangeGoogleIdTokenWithBackend({
      idToken,
      name: typeof jwt?.name === 'string' ? jwt.name : undefined,
      image: typeof jwt?.picture === 'string' ? jwt.picture : undefined,
    });

    const response = NextResponse.redirect(
      new URL('/oauth-complete', request.url),
    );
    response.cookies.set(APPLYMATE_AUTH_COOKIE, accessToken, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    });
    return response;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[google/finish]', err);
    }
    const code = googleAuthRedirectErrorParam(err);
    let reason: string | undefined;
    if (err instanceof GoogleAuthExchangeError) {
      reason = err.message;
      if (err.statusCode === 401) {
        reason = `${err.message} — Backend GOOGLE_CLIENT_ID must match your OAuth Web client ID.`;
      }
    } else if (err instanceof Error) {
      reason = err.message;
    }
    if (!reason?.trim()) {
      reason = `Cannot reach API at ${API_BASE_URL}auth/google`;
    }
    return loginRedirect(request, code, reason);
  }
}
