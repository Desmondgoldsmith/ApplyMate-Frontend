import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth-options';
import { exchangeGoogleIdTokenWithBackend } from '@/lib/auth-google-exchange';
import { APPLYMATE_AUTH_COOKIE } from '@/lib/authCookie';

export const dynamic = 'force-dynamic';

function loginUrl(request: Request, error?: string): URL {
  const url = new URL('/login', request.url);
  if (error) url.searchParams.set('error', error);
  return url;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const idToken = session?.googleIdToken?.trim();

  if (!idToken) {
    return NextResponse.redirect(loginUrl(request, 'GoogleSignInFailed'));
  }

  try {
    const { accessToken, user } = await exchangeGoogleIdTokenWithBackend({
      idToken,
      name: session?.user?.name ?? undefined,
      image: session?.user?.image ?? undefined,
    });

    const response = NextResponse.redirect(new URL('/auth/oauth-complete', request.url));
    response.cookies.set(APPLYMATE_AUTH_COOKIE, accessToken, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    });
    return response;
  } catch {
    return NextResponse.redirect(loginUrl(request, 'GoogleSignInFailed'));
  }
}
