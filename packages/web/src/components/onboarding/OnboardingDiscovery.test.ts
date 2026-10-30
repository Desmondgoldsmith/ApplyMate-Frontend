import { describe, expect, it } from 'vitest';

import { normalizeDiscoveryStep } from '@/components/onboarding/OnboardingDiscovery';

describe('normalizeDiscoveryStep', () => {
  it('keeps the four current steps', () => {
    expect([0, 1, 2, 3].map(normalizeDiscoveryStep)).toEqual([0, 1, 2, 3]);
  });

  it('maps the retired referral step (4) to target roles', () => {
    expect(normalizeDiscoveryStep(4)).toBe(3);
  });

  it('treats junk below zero as the welcome screen', () => {
    expect(normalizeDiscoveryStep(-1)).toBe(0);
  });
});
