import '@/lib/server/ensure-env';

import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeGoogleIdTokenWithBackend,
  GoogleAuthExchangeError,
} from '@/lib/auth-google-exchange';
import { isGoogleAuthConfigured } from '@/lib/auth-options';
import {
  APPLYMATE_AUTH_COOKIE,
  APPLYMATE_REFRESH_COOKIE,
} from '@/lib/authCookie';
import { googleAuthRedirectErrorParam } from '@/lib/google-auth-errors';
import {
  parseGoogleOAuthIntent,
  type GoogleOAuthIntent,
} from '@/lib/google-oauth-intent';
import { API_BASE_URL } from '@/lib/axios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authPageRedirect(
  request: NextRequest,
  intent: GoogleOAuthIntent,
  error: string,
  reason?: string,
): NextResponse {
  const path = intent === 'register' ? '/register' : '/login';
  const url = new URL(path, request.url);
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
  const intent = parseGoogleOAuthIntent(
    request.nextUrl.searchParams.get('intent'),
  );

  if (!isGoogleAuthConfigured()) {
    return authPageRedirect(
      request,
      intent,
      'GoogleSignInUnavailable',
      'Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or NEXTAUTH_SECRET. Restart dev server after updating .env.',
    );
  }

  const idToken = await readGoogleIdToken(request);
  if (!idToken) {
    return authPageRedirect(
      request,
      intent,
      'GoogleSignInFailed',
      'No Google ID token after OAuth. Check NEXTAUTH_SECRET and redirect URI in Google Cloud Console.',
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
    const { accessToken, refreshToken } = await exchangeGoogleIdTokenWithBackend({
      idToken,
      intent,
      name: typeof jwt?.name === 'string' ? jwt.name : undefined,
      image: typeof jwt?.picture === 'string' ? jwt.picture : undefined,
    });

    const completeUrl = new URL('/oauth-complete', request.url);
    completeUrl.searchParams.set('intent', intent);
    const response = NextResponse.redirect(completeUrl);
    const cookieOpts = {
      path: '/',
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    };
    response.cookies.set(APPLYMATE_AUTH_COOKIE, accessToken, cookieOpts);
    if (refreshToken?.trim()) {
      response.cookies.set(APPLYMATE_REFRESH_COOKIE, refreshToken.trim(), cookieOpts);
    }
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
        const fp = process.env.GOOGLE_CLIENT_ID?.trim();
        const idHint = fp
          ? `Nest GOOGLE_CLIENT_ID must be exactly: ${fp}`
          : 'Nest GOOGLE_CLIENT_ID must match the frontend OAuth Web client ID.';
        reason = `${err.message} — ${idHint}`;
      }
      if (err.statusCode === 404 && intent === 'login') {
        reason =
          'We did not find an account for this Google email. Use Sign up with Google to create one.';
      }
    } else if (err instanceof Error) {
      reason = err.message;
    }
    if (!reason?.trim()) {
      reason = `Cannot reach API at ${API_BASE_URL}auth/google`;
    }
    return authPageRedirect(request, intent, code, reason);
  }
}
