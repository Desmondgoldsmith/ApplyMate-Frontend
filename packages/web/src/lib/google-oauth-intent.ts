export type GoogleOAuthIntent = 'login' | 'register';

export function parseGoogleOAuthIntent(
  raw: string | null | undefined,
): GoogleOAuthIntent {
  return raw === 'register' ? 'register' : 'login';
}

export function googleOAuthFinishCallbackUrl(
  origin: string,
  intent: GoogleOAuthIntent,
): string {
  const url = new URL('/api/auth/google/finish', origin);
  url.searchParams.set('intent', intent);
  return url.toString();
}
