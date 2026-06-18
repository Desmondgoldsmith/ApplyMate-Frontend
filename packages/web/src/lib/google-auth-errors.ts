import { GoogleAuthExchangeError } from '@/lib/google-auth-exchange-error';
import { NEXTAUTH_API_BASE_PATH } from '@/lib/nextauth-api';

/** Query param values on `/login?error=` after Google OAuth finish failures. */
export type GoogleOAuthErrorParam =
  | 'GoogleSignInFailed'
  | 'GoogleAccountExists'
  | 'GoogleAccountNotFound'
  | 'GoogleRateLimited'
  | 'GoogleSignInUnavailable';

/** Backend `error.code` values from POST /auth/google (see backend handoff). */
export type BackendGoogleAuthErrorCode =
  | 'GOOGLE_SIGNIN_UNAVAILABLE'
  | 'GOOGLE_TOKEN_INVALID'
  | 'GOOGLE_ACCOUNT_EXISTS'
  | 'GOOGLE_ACCOUNT_NOT_FOUND'
  | 'RATE_LIMITED';

export function googleAuthRedirectErrorParam(
  err: unknown,
): GoogleOAuthErrorParam {
  if (err instanceof GoogleAuthExchangeError) {
    switch (err.code) {
      case 'GOOGLE_ACCOUNT_EXISTS':
        return 'GoogleAccountExists';
      case 'RATE_LIMITED':
        return 'GoogleRateLimited';
      case 'GOOGLE_SIGNIN_UNAVAILABLE':
        return 'GoogleSignInUnavailable';
      case 'GOOGLE_TOKEN_INVALID':
        return 'GoogleSignInFailed';
      case 'GOOGLE_ACCOUNT_NOT_FOUND':
        return 'GoogleAccountNotFound';
      default:
        break;
    }
    if (err.statusCode === 404) return 'GoogleAccountNotFound';
    if (err.statusCode === 409) return 'GoogleAccountExists';
    if (err.statusCode === 429) return 'GoogleRateLimited';
    if (err.statusCode === 400) return 'GoogleSignInUnavailable';
    if (err.statusCode === 401) return 'GoogleSignInFailed';
  }
  return 'GoogleSignInFailed';
}

function normalizeOAuthErrorCode(error: string | null): string | null {
  if (error == null) return null;
  const code = error.trim();
  if (!code || code === 'undefined' || code === 'null')
    return 'GoogleSignInFailed';
  return code;
}

export function googleOAuthErrorToastMessage(
  error: string | null,
  reason?: string | null,
  page?: 'login' | 'register',
): string | null {
  const code = normalizeOAuthErrorCode(error);
  if (!code) return null;

  const detail = reason?.trim();
  const withDetail = (base: string) => (detail ? `${base} ${detail}` : base);

  switch (code) {
    case 'GoogleAccountNotFound':
    case 'GOOGLE_ACCOUNT_NOT_FOUND':
      return withDetail(
        'No account for this Google email. Create an account on the sign-up page.',
      );
    case 'GoogleAccountExists':
    case 'GOOGLE_ACCOUNT_EXISTS':
      if (page === 'register') {
        return withDetail(
          'This email already has an account — sign in instead.',
        );
      }
      return withDetail(
        'An account with this email already exists. Sign in with your password or Google.',
      );
    case 'GoogleRateLimited':
    case 'RATE_LIMITED':
      return withDetail(
        'Too many sign-in attempts. Wait a minute and try again.',
      );
    case 'GoogleSignInUnavailable':
    case 'GOOGLE_SIGNIN_UNAVAILABLE':
      return withDetail(
        'Google sign-in is unavailable right now. Try email and password or contact support.',
      );
    case 'GoogleSignInFailed':
    case 'GOOGLE_TOKEN_INVALID':
      if (!detail) {
        return `Google sign-in failed. Restart the dev server, open ${NEXTAUTH_API_BASE_PATH}/google/status (should show googleAuthConfigured: true), then try again.`;
      }
      return withDetail(
        'Google sign-in failed. Try again or use email and password.',
      );
    case 'OAuthSignin':
    case 'Configuration':
      return 'Google sign-in is misconfigured. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL (must be this app, not the API), then restart the dev server.';
    case 'AccessDenied':
      return 'Google sign-in was denied or could not complete. Try again or use email and password.';
    case 'Callback':
      return 'Google callback failed. Add the correct redirect URI in Google Cloud Console (see docs/backend-handoff-google-auth.md).';
    default:
      return `Google sign-in failed (${code}). Try again or use email and password.`;
  }
}
