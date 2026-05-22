import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { reconcileAfterCvSuggestionMutation } from '@/lib/cvSuggestionMutationReconcile';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

describe('reconcileAfterCvSuggestionMutation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 when profileId is missing', () => {
    const qc = new QueryClient();
    const inv = reconcileAfterCvSuggestionMutation(qc, '', 'queueOnly');
    expect(inv).toBe(0);
  });

  it('invalidates scoped score + suggestions for this profile; cv-profiles only on structuralAccept', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);
    expect(reconcileAfterCvSuggestionMutation(qc, 'p1', 'queueOnly')).toBe(2);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['cv', 'score', 'p1'], exact: true });
    expect(spy).toHaveBeenCalledWith({ queryKey: cvSuggestionsQueryKey('p1'), exact: true });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['cv-profiles'], exact: true });

    spy.mockClear();
    expect(reconcileAfterCvSuggestionMutation(qc, 'p1', 'structuralAccept')).toBe(3);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['cv-profiles'], exact: true });
  });
});
