import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

/** Canonical CV React Query scope (per profile). */
export type RefreshCvStateProfileId = string | null | undefined;

export type RefreshCvStateOptions = {
  /** Await active refetches for `queryKeys.cv.profile(profileId)`. */
  refreshProfile?: boolean;
  /** Await active refetches for `queryKeys.cv.sections(profileId)`. */
  refreshSections?: boolean;
  /** Await active refetches for `['cv','suggestions', profileId]`. */
  refreshSuggestions?: boolean;
  /** Mark `queryKeys.cv.score(profileId)` stale (scoped); observers refetch if mounted. */
  invalidateScore?: boolean;
  /** When list metadata may have changed (rename, default flag, etc.). */
  invalidateCvProfilesList?: boolean;
};

function canonicalProfileId(profileId: RefreshCvStateProfileId): string | null {
  const id = String(profileId ?? '').trim();
  return id.length > 0 ? id : null;
}

/**
 * Single entry point for post-mutation CV cache alignment — avoids duplicate refetch/invalidate storms.
 * Uses only canonical per-profile keys; no unscoped `queryKeys.cv.scoreRoot()` or `queryKeys.cv.profileDefault()` sweeps.
 */
export async function refreshCvState(
  queryClient: QueryClient,
  profileId: RefreshCvStateProfileId,
  options: RefreshCvStateOptions,
): Promise<void> {
  const id = canonicalProfileId(profileId);
  const tasks: Array<Promise<unknown>> = [];

  if (id) {
    if (options.refreshProfile) {
      tasks.push(queryClient.refetchQueries({ queryKey: queryKeys.cv.profile(id), exact: true }));
    }
    if (options.refreshSections) {
      tasks.push(queryClient.refetchQueries({ queryKey: queryKeys.cv.sections(id), exact: true }));
    }
    if (options.refreshSuggestions) {
      tasks.push(queryClient.refetchQueries({ queryKey: cvSuggestionsQueryKey(id), exact: true }));
    }
  }

  await Promise.all(tasks);

  if (id && options.invalidateScore) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.score(id), exact: true });
  }

  if (options.invalidateCvProfilesList) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles(), exact: true });
  }
}
