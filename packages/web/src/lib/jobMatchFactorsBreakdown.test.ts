import { describe, expect, it } from 'vitest';

import { parseJobMatchFactorsBreakdown } from '@/lib/jobMatchFactorsBreakdown';

describe('parseJobMatchFactorsBreakdown', () => {
  it('parses factors array and preserves order', () => {
    const parsed = parseJobMatchFactorsBreakdown({
      factors: [
        {
          key: 'industryRelevance',
          label: 'Industry relevance',
          score: 90,
          explanation: 'Your background strongly aligns with fintech',
        },
        {
          key: 'skillsMatch',
          label: 'Skills match',
          score: 85,
          explanation: '18 of 22 required skills found in your CV',
          found: ['React', 'TypeScript'],
          missing: ['Kubernetes'],
        },
      ],
    });
    expect(parsed?.factors).toHaveLength(2);
    expect(parsed?.factors[0]?.key).toBe('skillsMatch');
    expect(parsed?.factors[1]?.key).toBe('industryRelevance');
    expect(parsed?.factors[0]?.found).toEqual(['React', 'TypeScript']);
  });

  it('returns null for empty payload', () => {
    expect(parseJobMatchFactorsBreakdown(null)).toBeNull();
    expect(parseJobMatchFactorsBreakdown({ factors: [] })).toBeNull();
  });
});
