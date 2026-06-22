import { describe, expect, it } from 'vitest';

import { normalizePublicApiUrl } from '@/lib/publicApiUrl';

describe('normalizePublicApiUrl', () => {
  it('strips internal whitespace from Vercel paste mistakes', () => {
    expect(
      normalizePublicApiUrl(
        ' https://prudence-monostome-donella.ngrok-free.dev /api/ ',
      ),
    ).toBe('https://prudence-monostome-donella.ngrok-free.dev/api/');
  });

  it('adds /api/ when only origin is given', () => {
    expect(normalizePublicApiUrl('https://foo.ngrok-free.dev')).toBe(
      'https://foo.ngrok-free.dev/api/',
    );
  });
});
