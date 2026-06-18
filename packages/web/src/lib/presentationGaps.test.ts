import { describe, expect, it } from 'vitest';

import { parsePresentationGaps } from '@/lib/presentationGaps';

describe('presentationGaps', () => {
  it('parses bullet-weave guidance rows', () => {
    const gaps = parsePresentationGaps([
      {
        skill: 'scalable',
        adviceType: 'use_in_bullets',
        guidance: 'Weave "scalable" into an achievement bullet.',
      },
      {
        skill: 'code reviews',
        advice_type: 'soft_context',
        guidance: 'Mention code reviews with a concrete example.',
      },
    ]);
    expect(gaps).toHaveLength(2);
    expect(gaps?.[0]?.adviceType).toBe('use_in_bullets');
    expect(gaps?.[1]?.adviceType).toBe('soft_context');
  });
});
