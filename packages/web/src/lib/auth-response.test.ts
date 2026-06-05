import { describe, expect, it } from 'vitest';

import { normalizeAuthResponse, normalizeRefreshResponse } from '@/lib/auth-response';

describe('normalizeAuthResponse', () => {
  it('unwraps success envelope with refreshToken and onboardingCompleted', () => {
    const result = normalizeAuthResponse({
      success: true,
      data: {
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
        user: {
          id: 'u-1',
          email: 'jane@gmail.com',
          name: 'Jane Doe',
          image: 'https://example.com/avatar.png',
          onboardingCompleted: false,
        },
      },
      error: null,
    });

    expect(result.accessToken).toBe('access-jwt');
    expect(result.refreshToken).toBe('refresh-jwt');
    expect(result.user.email).toBe('jane@gmail.com');
    expect(result.user.onboardingCompleted).toBe(false);
  });

  it('normalizeRefreshResponse matches login shape', () => {
    const result = normalizeRefreshResponse({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      user: { id: 'u-1', email: 'a@b.c' },
    });
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.user.email).toBe('a@b.c');
  });
});
