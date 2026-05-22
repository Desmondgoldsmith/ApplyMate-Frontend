import { describe, expect, it, vi } from 'vitest';

import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

import { commitAcceptedStructuredDraft, rehydrateCvBuilderAfterStructuredPersist } from './cvStructuredDraftCommit';

function makeQueryClient() {
  return {
    refetchQueries: vi.fn().mockResolvedValue(undefined),
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  } as unknown as import('@tanstack/react-query').QueryClient;
}

describe('commitAcceptedStructuredDraft', () => {
  it('throws when profileId is empty', async () => {
    const qc = makeQueryClient();
    await expect(
      commitAcceptedStructuredDraft({ queryClient: qc, profileId: '   ' }),
    ).rejects.toThrow('missing profileId');
  });

  it('runs mutation, scoped refetches (profile, sections, suggestions), onRehydrated, then scoped score invalidation', async () => {
    const qc = makeQueryClient();
    const mutation = vi.fn().mockResolvedValue(undefined);
    const onRehydrated = vi.fn();
    const id = 'p1';

    await commitAcceptedStructuredDraft({
      queryClient: qc,
      profileId: id,
      mutation,
      onRehydrated,
    });

    expect(mutation).toHaveBeenCalledTimes(1);
    expect(qc.refetchQueries).toHaveBeenCalledWith({
      queryKey: ['cv-profile', id],
      exact: true,
    });
    expect(qc.refetchQueries).toHaveBeenCalledWith({
      queryKey: ['cv-sections', id],
      exact: true,
    });
    expect(qc.refetchQueries).toHaveBeenCalledWith({
      queryKey: cvSuggestionsQueryKey(id),
      exact: true,
    });
    expect(onRehydrated).toHaveBeenCalledTimes(1);

    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cv', 'score', id], exact: true });
  });

  it('rehydrateCvBuilderAfterStructuredPersist omits mutation', async () => {
    const qc = makeQueryClient();
    const onRehydrated = vi.fn();
    const id = 'p2';

    await rehydrateCvBuilderAfterStructuredPersist(qc, id, onRehydrated);

    expect(qc.refetchQueries).toHaveBeenCalled();
    expect(onRehydrated).toHaveBeenCalledTimes(1);
  });
});
