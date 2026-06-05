import { queryKeys } from '@/lib/queryKeys';
import { describe, expect, it, vi } from 'vitest';

import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

import { refreshCvState } from './refreshCvState';

describe('refreshCvState', () => {
  it('no-ops when profileId is empty', async () => {
    const refetchQueries = vi.fn();
    const invalidateQueries = vi.fn();
    const qc = { refetchQueries, invalidateQueries } as never;
    await refreshCvState(qc, '  ', { refreshProfile: true });
    expect(refetchQueries).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('runs only selected refetches and invalidations with canonical keys', async () => {
    const refetchQueries = vi.fn().mockResolvedValue(undefined);
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const qc = { refetchQueries, invalidateQueries } as never;
    await refreshCvState(qc, 'abc', {
      refreshProfile: true,
      refreshSections: true,
      refreshSuggestions: false,
      invalidateScore: true,
      invalidateCvProfilesList: true,
    });
    expect(refetchQueries).toHaveBeenCalledTimes(2);
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.cv.profile('abc'),
      exact: true,
    });
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.cv.sections('abc'),
      exact: true,
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.cv.score('abc'), exact: true });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.cv.profiles(), exact: true });
  });

  it('refetches suggestions with canonical key', async () => {
    const refetchQueries = vi.fn().mockResolvedValue(undefined);
    const invalidateQueries = vi.fn();
    const qc = { refetchQueries, invalidateQueries } as never;
    await refreshCvState(qc, 'x', { refreshSuggestions: true });
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: cvSuggestionsQueryKey('x'),
      exact: true,
    });
  });
});
