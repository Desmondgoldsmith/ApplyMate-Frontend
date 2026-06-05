import { queryKeys } from '@/lib/queryKeys';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CVProfile } from '@/lib/api';
import { refreshCvStateAfterCvParseSuccess } from '@/lib/cvParseCacheReconcile';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

describe('refreshCvStateAfterCvParseSuccess', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets canonical profile cache and refetches scoped queries', async () => {
    const qc = new QueryClient();
    const refetchSpy = vi
      .spyOn(qc, 'refetchQueries')
      .mockResolvedValue(undefined);
    const invalidateSpy = vi
      .spyOn(qc, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const setSpy = vi.spyOn(qc, 'setQueryData');

    const profile: CVProfile = {
      id: 'pid-1',
      name: 'Test',
      template: 'modern',
      structured: {},
    } as CVProfile;

    await refreshCvStateAfterCvParseSuccess(qc, profile);

    expect(setSpy).toHaveBeenCalledWith(queryKeys.cv.profile('pid-1'), profile);
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.cv.profile('pid-1'),
      exact: true,
    });
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.cv.sections('pid-1'),
      exact: true,
    });
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: cvSuggestionsQueryKey('pid-1'),
      exact: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.cv.score('pid-1'),
      exact: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.cv.profiles(),
      exact: true,
    });
  });

  it('only invalidates cv-profiles when profile id is missing', async () => {
    const qc = new QueryClient();
    const invalidateSpy = vi
      .spyOn(qc, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const refetchSpy = vi.spyOn(qc, 'refetchQueries');

    await refreshCvStateAfterCvParseSuccess(qc, {
      id: '  ',
      name: 'X',
    } as CVProfile);

    expect(refetchSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.cv.profiles(),
      exact: true,
    });
  });
});
