import { describe, expect, it } from 'vitest';

import type { CvImprovementsPayload, CvSuggestionMutationResult, CvSuggestionsBulkMutationResult } from '@/lib/api';
import {
  applyBulkAcceptToImprovementsCache,
  applyBulkRejectToImprovementsCache,
  applySuggestionAcceptToImprovementsCache,
  applySuggestionRejectToImprovementsCache,
} from '@/lib/cvSuggestionsMutationApply';

const basePayload = (): CvImprovementsPayload => ({
  improvements: [
    { id: 'a', issue: 'x', resolved: false },
    { id: 'b', issue: 'y', resolved: false },
  ],
  pendingSuggestionsCount: 2,
  needsScoring: false,
});

describe('applySuggestionAcceptToImprovementsCache', () => {
  it('ignores overbroad acceptedSuggestionIds when accepted pointer is set', () => {
    const prev = basePayload();
    const product: CvSuggestionMutationResult = {
      pendingSuggestionsCount: 1,
      cvRevisionId: 'rev-1',
      acceptedSuggestionIds: ['a', 'b'],
    };
    const next = applySuggestionAcceptToImprovementsCache(prev, 'a', product);
    expect(next?.improvements.map((i) => i.id)).toEqual(['b']);
    expect(next?.pendingSuggestionsCount).toBe(1);
  });

  it('removes accepted id using acceptedSuggestionIds when provided', () => {
    const prev = basePayload();
    const product: CvSuggestionMutationResult = {
      pendingSuggestionsCount: 1,
      cvRevisionId: 'rev-1',
      acceptedSuggestionIds: ['a'],
    };
    const next = applySuggestionAcceptToImprovementsCache(prev, 'a', product);
    expect(next?.improvements.map((i) => i.id)).toEqual(['b']);
    expect(next?.pendingSuggestionsCount).toBe(1);
    expect(next?.cvRevisionId).toBe('rev-1');
  });

  it('falls back to accepted pointer when ids absent', () => {
    const prev = basePayload();
    const product: CvSuggestionMutationResult = {
      pendingSuggestionsCount: 1,
      cvRevisionId: null,
    };
    const next = applySuggestionAcceptToImprovementsCache(prev, 'b', product);
    expect(next?.improvements.map((i) => i.id)).toEqual(['a']);
  });

  it('merges structuredRevisionHash from response', () => {
    const prev = { ...basePayload(), structuredRevisionHash: 'old' };
    const product: CvSuggestionMutationResult = {
      pendingSuggestionsCount: 1,
      cvRevisionId: 'r1',
      acceptedSuggestionIds: ['a'],
      structuredRevisionHash: 'new-hash',
    };
    const next = applySuggestionAcceptToImprovementsCache(prev, 'a', product);
    expect(next?.structuredRevisionHash).toBe('new-hash');
  });
});

describe('applyBulkAcceptToImprovementsCache', () => {
  it('filters by acceptedSuggestionIds', () => {
    const prev = basePayload();
    const r: CvSuggestionsBulkMutationResult = {
      acceptedSuggestionIds: ['a', 'b'],
      pendingSuggestionsCount: 0,
      cvRevisionId: 'rev-2',
    };
    const next = applyBulkAcceptToImprovementsCache(prev, r);
    expect(next?.improvements).toHaveLength(0);
    expect(next?.pendingSuggestionsCount).toBe(0);
  });

  it('clears queue when remainingPendingCount is 0 without ids', () => {
    const prev = basePayload();
    const r: CvSuggestionsBulkMutationResult = {
      remainingPendingCount: 0,
      pendingSuggestionsCount: 0,
      cvRevisionId: 'rev-3',
      structuredRevisionHash: 'hash-1',
    };
    const next = applyBulkAcceptToImprovementsCache(prev, r);
    expect(next?.improvements).toHaveLength(0);
    expect(next?.pendingSuggestionsCount).toBe(0);
    expect(next?.cvRevisionId).toBe('rev-3');
    expect(next?.structuredRevisionHash).toBe('hash-1');
  });

  it('clears queue when pendingSuggestionsCount is 0 without ids', () => {
    const prev = basePayload();
    const r: CvSuggestionsBulkMutationResult = {
      pendingSuggestionsCount: 0,
    };
    const next = applyBulkAcceptToImprovementsCache(prev, r);
    expect(next?.improvements).toHaveLength(0);
    expect(next?.pendingSuggestionsCount).toBe(0);
  });
});

describe('applyBulkRejectToImprovementsCache', () => {
  it('filters by rejectedSuggestionIds', () => {
    const prev = basePayload();
    const r: CvSuggestionsBulkMutationResult = {
      rejectedSuggestionIds: ['a'],
      pendingSuggestionsCount: 1,
    };
    const next = applyBulkRejectToImprovementsCache(prev, r);
    expect(next?.improvements.map((i) => i.id)).toEqual(['b']);
  });

  it('clears queue when remainingPendingCount is 0 without ids', () => {
    const prev = basePayload();
    const r: CvSuggestionsBulkMutationResult = {
      remainingPendingCount: 0,
      pendingSuggestionsCount: 0,
    };
    const next = applyBulkRejectToImprovementsCache(prev, r);
    expect(next?.improvements).toHaveLength(0);
  });
});

describe('applySuggestionRejectToImprovementsCache', () => {
  it('uses rejectedSuggestionIds when present', () => {
    const prev = basePayload();
    const product: CvSuggestionMutationResult = {
      pendingSuggestionsCount: 1,
      cvRevisionId: null,
      rejectedSuggestionIds: ['b'],
    };
    const next = applySuggestionRejectToImprovementsCache(prev, 'ignored', product);
    expect(next?.improvements.map((i) => i.id)).toEqual(['a']);
  });
});
