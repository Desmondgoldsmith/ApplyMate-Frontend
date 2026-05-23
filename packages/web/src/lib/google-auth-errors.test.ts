import { describe, expect, it } from 'vitest';

import { GoogleAuthExchangeError } from '@/lib/google-auth-exchange-error';
import {
  googleAuthRedirectErrorParam,
  googleOAuthErrorToastMessage,
} from '@/lib/google-auth-errors';

describe('google-auth-errors', () => {
  it('maps HTTP status to redirect error param', () => {
    expect(
      googleAuthRedirectErrorParam(
        new GoogleAuthExchangeError('x', 409, 'GOOGLE_ACCOUNT_EXISTS'),
      ),
    ).toBe('GoogleAccountExists');
    expect(
      googleAuthRedirectErrorParam(
        new GoogleAuthExchangeError('x', 429, 'RATE_LIMITED'),
      ),
    ).toBe('GoogleRateLimited');
    expect(
      googleAuthRedirectErrorParam(
        new GoogleAuthExchangeError('x', 400, 'GOOGLE_SIGNIN_UNAVAILABLE'),
      ),
    ).toBe('GoogleSignInUnavailable');
    expect(
      googleAuthRedirectErrorParam(
        new GoogleAuthExchangeError('x', 401, 'GOOGLE_TOKEN_INVALID'),
      ),
    ).toBe('GoogleSignInFailed');
  });

  it('returns user-facing toast copy', () => {
    expect(googleOAuthErrorToastMessage('GoogleAccountExists')).toMatch(
      /password/i,
    );
    expect(googleOAuthErrorToastMessage('GoogleRateLimited')).toMatch(
      /minute/i,
    );
    expect(googleOAuthErrorToastMessage('undefined')).toMatch(/failed/i);
    expect(
      googleOAuthErrorToastMessage(
        'GoogleSignInFailed',
        'Backend rejected token',
      ),
    ).toMatch(/Backend rejected token/);
    expect(googleOAuthErrorToastMessage(null)).toBeNull();
  });
});
