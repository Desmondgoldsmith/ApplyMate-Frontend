import { describe, expect, it } from 'vitest';

import { getFormatRecommendation } from './cvFormatRecommendation';

describe('getFormatRecommendation', () => {
  it('follows the score career stage, not the number of jobs', () => {
    const r = getFormatRecommendation({
      careerStage: 'mid',
      experienceCount: 2,
    });
    expect(r.label).toBe('Mid career (3–8 years)');
    expect(r.recommended).toBe('classic');
  });

  it('falls back to the job count before the CV is scored', () => {
    expect(getFormatRecommendation({ experienceCount: 0 }).recommended).toBe(
      'modern',
    );
    expect(
      getFormatRecommendation({ careerStage: undefined, experienceCount: 7 })
        .label,
    ).toBe('Senior (8+ years)');
  });
});
