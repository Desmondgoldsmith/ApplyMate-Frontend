import { resolveEffectiveLocationClient } from './resolve-effective-location-client';

describe('resolveEffectiveLocationClient', () => {
  it('prefers saved preference over IP', () => {
    const r = resolveEffectiveLocationClient({
      savedPreference: 'Accra, Ghana',
      detected: {
        country: 'United States',
        countryCode: 'US',
        city: 'New York',
        region: null,
        timezone: null,
        confidence: 'high',
      },
    });
    expect(r.source).toBe('saved_preference');
    expect(r.label).toContain('Accra');
  });
});
