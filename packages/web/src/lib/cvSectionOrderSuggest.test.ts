import { describe, expect, it } from 'vitest';

import {
  normalizeCvSectionOrderSuggestResult,
  splitSuggestedOrder,
} from '@/lib/cvSectionOrderSuggest';

describe('cvSectionOrderSuggest', () => {
  it('normalizes suggest-order API payload', () => {
    const result = normalizeCvSectionOrderSuggestResult({
      careerStage: 'mid',
      industry: 'technology',
      industryLabel: 'Technology',
      currentOrder: ['b', 'a'],
      suggestedOrder: ['a', 'b', 'hidden-1'],
      isOptimal: false,
      showProactiveSuggestion: true,
      overview: 'Two sections would move.',
      changes: [
        {
          sectionId: 'a',
          type: 'summary',
          label: 'Summary',
          fromPosition: 2,
          toPosition: 1,
          explanation: 'Summary first.',
        },
      ],
    });
    expect(result.careerStage).toBe('mid');
    expect(result.showProactiveSuggestion).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.suggestedOrder).toEqual(['a', 'b', 'hidden-1']);
  });

  it('keeps hidden section ids at the tail when splitting', () => {
    const { visible, hiddenTail } = splitSuggestedOrder(
      ['skills', 'summary', 'experience'],
      ['summary', 'experience', 'skills', 'hidden-ref'],
    );
    expect(visible).toEqual(['summary', 'experience', 'skills']);
    expect(hiddenTail).toEqual(['hidden-ref']);
  });
});
