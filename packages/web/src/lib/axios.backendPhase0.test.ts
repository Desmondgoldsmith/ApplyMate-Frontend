import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';

import {
  AUTH_RATE_LIMIT_USER_MESSAGE,
  BACKEND_TIMEOUT_ERROR_CODE,
  BACKEND_UNREACHABLE_ERROR_CODE,
  GENERIC_SERVER_ERROR_USER_MESSAGE,
  getApiErrorMessage,
  isAuthRateLimitError,
  isBackendConnectionError,
  isDailyAiLimitApiError,
  shouldRetryFailedQuery,
} from '@/lib/axios';

function axiosErr(status: number, url: string, data?: Record<string, unknown>): AxiosError {
  const cfg = { url, baseURL: 'http://localhost:3000/api/' };
  return new AxiosError(
    'fail',
    AxiosError.ERR_BAD_REQUEST,
    cfg as never,
    undefined,
    {
      status,
      data,
      statusText: 'Err',
      headers: {},
      config: cfg as never,
    },
  );
}

describe('backend Phase 0 — auth throttle & safe 5xx', () => {
  it('detects 429 on auth routes as auth rate limit', () => {
    expect(isAuthRateLimitError(axiosErr(429, '/auth/login'))).toBe(true);
    expect(isAuthRateLimitError(axiosErr(429, 'auth/login'))).toBe(true);
    expect(isAuthRateLimitError(axiosErr(429, '/auth/register'))).toBe(true);
    expect(isAuthRateLimitError(axiosErr(429, '/auth/refresh'))).toBe(true);
  });

  it('does not treat 429 on non-auth routes as auth rate limit', () => {
    expect(isAuthRateLimitError(axiosErr(429, '/jobs/analyze'))).toBe(false);
  });

  it('getApiErrorMessage uses throttle copy for auth 429', () => {
    expect(getApiErrorMessage(axiosErr(429, '/auth/login', { message: 'Throttled' }))).toBe(
      AUTH_RATE_LIMIT_USER_MESSAGE,
    );
  });

  it('getApiErrorMessage uses generic copy for 500/502/504 bodies', () => {
    expect(
      getApiErrorMessage(
        axiosErr(500, '/users/me', {
          message: 'Internal stack trace or debug detail — must not surface',
        }),
      ),
    ).toBe(GENERIC_SERVER_ERROR_USER_MESSAGE);
    expect(getApiErrorMessage(axiosErr(502, '/dashboard/today-plan', {}))).toBe(
      GENERIC_SERVER_ERROR_USER_MESSAGE,
    );
  });

  it('does not classify auth 429 as daily AI limit', () => {
    expect(isDailyAiLimitApiError(axiosErr(429, '/auth/login'))).toBe(false);
  });

  it('shouldRetryFailedQuery skips 401/403/429', () => {
    expect(shouldRetryFailedQuery(0, axiosErr(429, '/users/me'))).toBe(false);
    expect(shouldRetryFailedQuery(0, axiosErr(401, '/users/me'))).toBe(false);
    expect(shouldRetryFailedQuery(0, axiosErr(403, '/users/me'))).toBe(false);
    expect(shouldRetryFailedQuery(0, axiosErr(500, '/users/me'))).toBe(true);
    expect(shouldRetryFailedQuery(2, axiosErr(500, '/users/me'))).toBe(false);
  });

  it('shouldRetryFailedQuery skips backend unreachable and 502 proxy failures', () => {
    const networkErr = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(shouldRetryFailedQuery(0, networkErr)).toBe(false);
    expect(
      shouldRetryFailedQuery(
        0,
        axiosErr(502, '/jobs/x', {
          success: false,
          error: { code: BACKEND_UNREACHABLE_ERROR_CODE, message: 'down' },
        }),
      ),
    ).toBe(false);
    expect(isBackendConnectionError(networkErr)).toBe(true);
    expect(
      isBackendConnectionError(
        axiosErr(502, '/jobs/x', {
          error: { code: BACKEND_TIMEOUT_ERROR_CODE },
        }),
      ),
    ).toBe(true);
    expect(
      getApiErrorMessage(
        axiosErr(502, '/jobs/x', {
          error: { code: BACKEND_UNREACHABLE_ERROR_CODE, message: 'Cannot reach' },
        }),
      ),
    ).toContain('Cannot reach');
  });
});
