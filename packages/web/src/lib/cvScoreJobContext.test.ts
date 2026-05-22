import { describe, expect, it } from 'vitest';

import { cvScoreJobContextMeaningful, cvScorePreferDetailedPostBodyForJobDescription } from '@/lib/cvScoreJobContext';

describe('cvScoreJobContext', () => {
  it('requires JD length ≥40 or role length ≥3', () => {
    expect(cvScoreJobContextMeaningful('', '')).toBe(false);
    expect(cvScoreJobContextMeaningful('x'.repeat(39), '')).toBe(false);
    expect(cvScoreJobContextMeaningful('x'.repeat(40), '')).toBe(true);
    expect(cvScoreJobContextMeaningful('', 'ab')).toBe(false);
    expect(cvScoreJobContextMeaningful('', 'abc')).toBe(true);
  });

  it('prefers POST body for long JD', () => {
    expect(cvScorePreferDetailedPostBodyForJobDescription('a'.repeat(400))).toBe(false);
    expect(cvScorePreferDetailedPostBodyForJobDescription('a'.repeat(401))).toBe(true);
  });
});
