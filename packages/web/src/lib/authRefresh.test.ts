import { describe, expect, it } from 'vitest';

import { decodeJwtExp, isRefreshTokenReuseError } from '@/lib/authRefresh';
import { AxiosError } from 'axios';

function b64urlJson(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function jwtWithExp(exp: number): string {
  return `${b64urlJson({ alg: 'none', typ: 'JWT' })}.${b64urlJson({ exp })}.sig`;
}

describe('decodeJwtExp', () => {
  it('reads exp from a JWT payload', () => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    expect(decodeJwtExp(jwtWithExp(exp))).toBe(exp);
  });

  it('returns null for non-JWT strings', () => {
    expect(decodeJwtExp('not-a-jwt')).toBeNull();
  });
});

describe('isRefreshTokenReuseError', () => {
  it('detects REFRESH_TOKEN_REUSE_DETECTED code', () => {
    const err = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: {} as never,
      data: {
        error: {
          code: 'REFRESH_TOKEN_REUSE_DETECTED',
          message: 'Session expired. Please sign in again.',
        },
      },
    });
    expect(isRefreshTokenReuseError(err)).toBe(true);
  });
});
