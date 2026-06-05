import { describe, expect, it } from 'vitest';

import { jobAnalyzeCandidateLocationFields } from '@/lib/jobAnalyzeCandidateLocation';

describe('jobAnalyzeCandidateLocationFields', () => {
  it('prefers user location then job search preference', () => {
    expect(
      jobAnalyzeCandidateLocationFields({
        userLocation: 'Lagos, Nigeria',
        jobSearchLocation: 'Accra',
        detectedCountryCode: 'ng',
      }),
    ).toEqual({
      candidateLocation: 'Lagos, Nigeria',
      candidateCountryCode: 'NG',
    });
  });

  it('omits empty fields', () => {
    expect(jobAnalyzeCandidateLocationFields({})).toEqual({});
  });
});
